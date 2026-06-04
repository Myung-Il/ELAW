// Supabase 문제 데이터셋 벌크 적재 스크립트
// backend/core/management/commands/load_problems.py 의 매핑 규칙을 PostgREST 기반으로 이식
//
// 사용법:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=... node scripts/load_supabase_problems.mjs
//
// 전제: job_problems / job_problem_clusters / problem_edges / learning_path_meta 에
//       임시 insert 정책이 켜져 있어야 함 (적재 후 정책 제거)

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_ANON_KEY
if (!URL_BASE || !KEY) {
  console.error("SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 필요합니다.")
  process.exit(1)
}

const ROOT = path.resolve(import.meta.dirname, "..")
const PROBLEMS_DIR = path.join(ROOT, "DB", "JobProblems")
const PATHS_DIR = path.join(ROOT, "DB", "LearningPaths")

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
}

async function insertRows(table, rows, onConflict) {
  // 500행 단위 배치, 중복은 무시 (재실행 안전)
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const url = `${URL_BASE}/rest/v1/${table}?on_conflict=${onConflict}`
    const res = await fetch(url, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${table} 적재 실패 (${res.status}): ${text.slice(0, 500)}`)
    }
  }
}

async function fetchAll(table, select) {
  // PostgREST 기본 1000행 제한 → offset 페이지네이션
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${URL_BASE}/rest/v1/${table}?select=${select}&limit=1000&offset=${offset}`,
      { headers: HEADERS },
    )
    if (!res.ok) throw new Error(`${table} 조회 실패 (${res.status})`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

// load_problems.py::_resolve_job_role 대응 — 특수문자 차이 보정 (AR&VR, UI&UX 등)
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, "")
// 문제 행의 job_role이 파일명 기반 직군과 같은 직군인지 판정 (구분자 차이는 허용)
const matchesRole = (raw, fallbackRole) =>
  raw != null && normalize(String(raw)) === normalize(fallbackRole)
function resolveJobRole(raw, actualRoles) {
  const role = raw.replace(/_/g, " ")
  if (actualRoles.includes(role)) return role
  const target = normalize(role)
  for (const actual of actualRoles) if (normalize(actual) === target) return actual
  return role
}

// ── 1단계: job_problems 적재 ─────────────────────────────
console.log("1/3 job_problems 적재 중...")
let problemTotal = 0
for (const file of (await readdir(PROBLEMS_DIR)).filter((f) => f.endsWith(".json"))) {
  const fallbackRole = file.replace(".json", "").replace(/_/g, " ")
  const problems = JSON.parse(await readFile(path.join(PROBLEMS_DIR, file), "utf8"))
  // 원본 데이터 키 변형 보정: 일부 파일에 role(→job_role), this_id(→question_id), question 누락 존재
  // 모든 키를 명시적으로 null 처리해야 PostgREST 배치 인서트(PGRST102: 키 일치 요구)가 통과함
  const rows = problems
    .filter((p) => (p.question_id ?? p.this_id) != null)
    .map((p) => ({
      original_question_id: p.question_id ?? p.this_id,
      // 원본 오염 보정: job_role이 파일명과 의미상 불일치하면(예: 'senior_level',
      // 'Computerบิน Engineer' 같은 깨진 값) 파일명 기반 직군을 신뢰한다
      job_role: matchesRole(p.job_role ?? p.role, fallbackRole) ? (p.job_role ?? p.role) : fallbackRole,
      difficulty: p.difficulty ?? "unknown",
      question_type: p.question_type ?? null,
      category: p.category ?? "Uncategorized",
      subcategory: p.subcategory ?? null,
      skills_required: p.skills_required ?? [],
      scenario: p.scenario ?? null,
      question: p.question ?? p.scenario ?? "(문제 본문 누락)",
      choices: p.choices ?? [],
      correct_answer: String(p.correct_answer ?? ""),
      explanation: p.explanation ?? null,
    }))
  await insertRows("job_problems", rows, "job_role,original_question_id")
  problemTotal += rows.length
  process.stdout.write(`  [${fallbackRole}] ${rows.length}문제\n`)
}
console.log(`  → 총 ${problemTotal}문제 적재 요청 완료`)

// ── 2단계: (job_role, original_question_id) → id 매핑 구축 ──
console.log("2/3 문제 ID 매핑 구축 중...")
const allProblems = await fetchAll("job_problems", "id,job_role,original_question_id")
const idMap = new Map() // `${job_role}::${qid}` → id
for (const p of allProblems) idMap.set(`${p.job_role}::${p.original_question_id}`, p.id)
const actualRoles = [...new Set(allProblems.map((p) => p.job_role))]
console.log(`  → ${allProblems.length}문제 / ${actualRoles.length}개 직군`)

// ── 3단계: 학습경로 (메타 + 클러스터 + 엣지) 적재 ─────────
console.log("3/3 학습경로 적재 중...")
let clusterTotal = 0, edgeTotal = 0, skipTotal = 0
for (const file of (await readdir(PATHS_DIR)).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(await readFile(path.join(PATHS_DIR, file), "utf8"))
  const meta = data.metadata ?? {}
  const params = meta.parameters ?? {}
  const jobRole = resolveJobRole(meta.job_role ?? file.replace("_path.json", ""), actualRoles)

  // learning_path_meta (직군당 1행)
  await insertRows("learning_path_meta", [{
    job_role: jobRole,
    source_file: meta.source_file ?? file,
    total_problems: meta.total_problems ?? 0,
    cluster_count: meta.cluster_count ?? 0,
    edge_count: meta.edge_count ?? 0,
    isolated_problem_count: meta.isolated_problem_count ?? 0,
    difficulty_distribution: meta.difficulty_distribution ?? {},
    skill_weight: params.skill_weight ?? 0.6,
    scenario_weight: params.scenario_weight ?? 0.4,
    min_combined_score: params.min_combined_score ?? 0.15,
    max_prereqs_per_target: params.max_prereqs_per_target ?? 3,
    same_category_bonus: params.same_category_bonus ?? 0.1,
  }], "job_role")

  // job_problem_clusters
  const clusterRows = (data.clusters ?? []).map((c) => ({
    job_role: jobRole,
    cluster_id: c.cluster_id,
    category: c.category,
    subcategory: c.subcategory ?? null,
    size: c.size ?? (c.question_ids?.length ?? 0),
    question_ids: c.question_ids ?? [],
    common_skills: c.common_skills ?? null,
    skill_weight: params.skill_weight ?? 0.6,
    scenario_weight: params.scenario_weight ?? 0.4,
    min_combined_score: params.min_combined_score ?? 0.15,
    same_category_bonus: params.same_category_bonus ?? 0.1,
  }))
  await insertRows("job_problem_clusters", clusterRows, "job_role,cluster_id")
  clusterTotal += clusterRows.length

  // problem_edges — Preceding_ID/Target_ID(원본 question_id)를 DB id로 해석
  const edges = data.dependency_graph?.edges ?? data.edges ?? []
  const seen = new Set()
  const edgeRows = []
  let skipped = 0
  for (const e of edges) {
    const srcId = idMap.get(`${jobRole}::${e.Preceding_ID ?? e.source}`)
    const tgtId = idMap.get(`${jobRole}::${e.Target_ID ?? e.target}`)
    if (!srcId || !tgtId) { skipped++; continue } // 그래프 참조 누락 — Django 로더와 동일하게 경고 후 스킵
    const key = `${srcId}-${tgtId}`
    if (seen.has(key)) continue
    seen.add(key)
    edgeRows.push({
      job_role: jobRole,
      source_problem_id: srcId,
      target_problem_id: tgtId,
      combined_score: e.combined_score ?? 0,
      skill_overlap: e.skill_overlap ?? null,
      scenario_similarity: e.scenario_similarity ?? null,
      is_prerequisite: e.is_prerequisite ?? false,
    })
  }
  await insertRows("problem_edges", edgeRows, "source_problem_id,target_problem_id")
  edgeTotal += edgeRows.length
  skipTotal += skipped
  process.stdout.write(`  [${jobRole}] 클러스터 ${clusterRows.length} / 엣지 ${edgeRows.length}${skipped ? ` (참조누락 ${skipped} 스킵)` : ""}\n`)
}

console.log("\n[완료] 적재 요청 요약")
console.log(`   job_problems        : ${problemTotal}`)
console.log(`   job_problem_clusters: ${clusterTotal}`)
console.log(`   problem_edges       : ${edgeTotal} (스킵 ${skipTotal})`)
console.log(`   learning_path_meta  : 30 (직군당 1행)`)
