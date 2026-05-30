export interface StudyTopic {
  id: string
  name: string
  category: string
}

export const jobFields = [
  {
    id: "backend",
    name: "백엔드 개발자",
    description: "서버·API·DB 설계 및 구현",
    icon: "⚙️",
  },
  {
    id: "frontend",
    name: "프론트엔드 개발자",
    description: "웹 UI/UX 구현 및 사용자 경험 설계",
    icon: "🖥️",
  },
  {
    id: "fullstack",
    name: "풀스택 개발자",
    description: "프론트엔드·백엔드 전반 개발",
    icon: "🚀",
  },
  {
    id: "data",
    name: "데이터 사이언티스트",
    description: "데이터 분석·머신러닝·통계",
    icon: "📊",
  },
  {
    id: "ai",
    name: "AI/ML 엔지니어",
    description: "딥러닝·모델 학습·MLOps",
    icon: "🤖",
  },
  {
    id: "devops",
    name: "DevOps/클라우드 엔지니어",
    description: "CI/CD·컨테이너·클라우드 인프라",
    icon: "☁️",
  },
  {
    id: "mobile",
    name: "모바일 개발자",
    description: "iOS·Android·크로스플랫폼 앱 개발",
    icon: "📱",
  },
  {
    id: "security",
    name: "보안 엔지니어",
    description: "네트워크 보안·취약점 분석·정보보호",
    icon: "🔒",
  },
]

export const studyTopics: StudyTopic[] = [
  // 알고리즘
  { id: "algo_sort", name: "정렬 알고리즘", category: "알고리즘" },
  { id: "algo_search", name: "탐색 알고리즘", category: "알고리즘" },
  { id: "algo_dp", name: "동적 프로그래밍", category: "알고리즘" },
  { id: "algo_graph", name: "그래프 이론", category: "알고리즘" },
  { id: "algo_greedy", name: "그리디 알고리즘", category: "알고리즘" },
  { id: "algo_tree", name: "트리 구조", category: "알고리즘" },
  // 자료구조
  { id: "ds_array", name: "배열·리스트", category: "자료구조" },
  { id: "ds_stack", name: "스택·큐", category: "자료구조" },
  { id: "ds_hash", name: "해시 테이블", category: "자료구조" },
  { id: "ds_heap", name: "힙·우선순위 큐", category: "자료구조" },
  // 백엔드
  { id: "be_rest", name: "REST API 설계", category: "백엔드" },
  { id: "be_db", name: "데이터베이스 설계", category: "백엔드" },
  { id: "be_auth", name: "인증·인가 (JWT/OAuth)", category: "백엔드" },
  { id: "be_django", name: "Django/DRF", category: "백엔드" },
  { id: "be_spring", name: "Spring Boot", category: "백엔드" },
  { id: "be_node", name: "Node.js/Express", category: "백엔드" },
  // 프론트엔드
  { id: "fe_react", name: "React/Next.js", category: "프론트엔드" },
  { id: "fe_ts", name: "TypeScript", category: "프론트엔드" },
  { id: "fe_css", name: "CSS/Tailwind", category: "프론트엔드" },
  { id: "fe_state", name: "상태 관리", category: "프론트엔드" },
  // 데이터/AI
  { id: "ml_python", name: "Python 데이터 분석", category: "데이터/AI" },
  { id: "ml_ml", name: "머신러닝 기초", category: "데이터/AI" },
  { id: "ml_dl", name: "딥러닝 (PyTorch/TF)", category: "데이터/AI" },
  { id: "ml_nlp", name: "자연어 처리 (NLP)", category: "데이터/AI" },
  { id: "ml_cv", name: "컴퓨터 비전", category: "데이터/AI" },
  // 인프라
  { id: "infra_docker", name: "Docker/컨테이너", category: "인프라" },
  { id: "infra_k8s", name: "Kubernetes", category: "인프라" },
  { id: "infra_cicd", name: "CI/CD 파이프라인", category: "인프라" },
  { id: "infra_aws", name: "AWS/GCP/Azure", category: "인프라" },
  // CS 기초
  { id: "cs_os", name: "운영체제", category: "CS 기초" },
  { id: "cs_net", name: "네트워크", category: "CS 기초" },
  { id: "cs_db", name: "데이터베이스", category: "CS 기초" },
  { id: "cs_oop", name: "객체지향 프로그래밍", category: "CS 기초" },
]

export const jobTopicMap: Record<string, string[]> = {
  backend: [
    "algo_sort", "algo_search", "algo_dp", "algo_graph",
    "ds_array", "ds_stack", "ds_hash", "ds_heap",
    "be_rest", "be_db", "be_auth", "be_django", "be_spring", "be_node",
    "cs_os", "cs_net", "cs_db", "cs_oop",
  ],
  frontend: [
    "algo_sort", "algo_search",
    "ds_array", "ds_hash",
    "fe_react", "fe_ts", "fe_css", "fe_state",
    "cs_net", "cs_oop",
  ],
  fullstack: [
    "algo_sort", "algo_search", "algo_dp",
    "ds_array", "ds_stack", "ds_hash",
    "be_rest", "be_db", "be_auth", "be_django", "be_node",
    "fe_react", "fe_ts", "fe_css", "fe_state",
    "cs_os", "cs_net", "cs_db", "cs_oop",
  ],
  data: [
    "algo_sort", "algo_search", "algo_dp",
    "ds_array", "ds_hash", "ds_heap",
    "ml_python", "ml_ml", "ml_dl", "ml_nlp", "ml_cv",
    "cs_db", "cs_oop",
  ],
  ai: [
    "algo_dp", "algo_graph",
    "ds_hash", "ds_heap",
    "ml_python", "ml_ml", "ml_dl", "ml_nlp", "ml_cv",
    "infra_docker", "infra_cicd",
    "cs_os", "cs_oop",
  ],
  devops: [
    "infra_docker", "infra_k8s", "infra_cicd", "infra_aws",
    "cs_os", "cs_net",
    "be_rest", "be_db",
  ],
  mobile: [
    "algo_sort", "algo_search",
    "ds_array", "ds_hash",
    "fe_ts", "fe_state",
    "cs_net", "cs_oop",
  ],
  security: [
    "algo_sort", "algo_search", "algo_graph",
    "be_auth",
    "cs_os", "cs_net", "cs_db",
    "infra_docker",
  ],
}

export function getTopicsForJobRole(jobRole: string): StudyTopic[] {
  const entry = jobFields.find(
    (j) => j.name === jobRole || j.id === jobRole,
  )
  if (!entry) return studyTopics
  const ids = jobTopicMap[entry.id] ?? []
  return studyTopics.filter((t) => ids.includes(t.id))
}

export { studyTopics as allTopics }
