import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  GraduationCap,
  Building2,
  Trophy,
  Brain,
  BookOpen,
  Users,
  Briefcase,
  Sparkles,
  ChevronRight,
  Play,
  Clock,
  TrendingUp,
  Award,
  Calendar
} from "lucide-react"

// [FE 수정 매뉴얼] 아래 배열 데이터(departments, companies, events)들은 현재 하드코딩 되어있습니다.
// 추후 DB에서 실시간으로 가져와야 한다면 이 부분들을 지우고 useEffect나 React Query를 통해 백엔드 API를 호출해야 합니다.

// [BE 매뉴얼] GET /api/v1/departments (학과 리스트 반환 API)
// [DB 매뉴얼] Departments 테이블: name(이름), courses_count(강좌수), students_count(학생수)
const departments = [
  { name: "컴퓨터공학", courses: 48, students: 1250 },
  { name: "전자공학", courses: 42, students: 980 },
  { name: "기계공학", courses: 38, students: 870 },
  { name: "화학공학", courses: 35, students: 720 },
  { name: "건축공학", courses: 32, students: 650 },
  { name: "산업공학", courses: 30, students: 580 },
]

// [BE 매뉴얼] GET /api/v1/companies/partner (파트너 기업 리스트 반환 API)
// [DB 매뉴얼] Companies 테이블 내 파트너 여부 플래그 및 진행중인 포지션 수(positions)
const companies = [
  { name: "삼성전자", field: "IT/반도체", positions: 120, logo: "S" },
  { name: "현대자동차", field: "자동차", positions: 85, logo: "H" },
  { name: "LG전자", field: "전자", positions: 75, logo: "L" },
  { name: "SK하이닉스", field: "반도체", positions: 68, logo: "SK" },
]

// [BE 매뉴얼] GET /api/v1/events (대회/이벤트 리스트 반환 API)
// [DB 매뉴얼] Events 테이블: title(제목), event_date(행사일, 이를 기반으로 dDay 계산 필요), type(종류), prize(상금)
const events = [
  { title: "2024 전국 대학생 SW 경진대회", dDay: 15, type: "대회", prize: "1,000만원" },
  { title: "삼성 청년 SW 아카데미 12기 모집", dDay: 7, type: "프로그램", prize: "교육비 전액" },
  { title: "AI 해커톤 챌린지", dDay: 23, type: "대회", prize: "500만원" },
]

export default function HomePage() {
  // [FE/BE/DB 공통 설명] 이 페이지는 로그인 전 사용자가 보는 랜딩 페이지입니다.
  // 데이터를 갱신하는 POST/PUT 통신보다는 주로 GET 통신(조회) 위주로 구성됩니다.
  return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="text-xl font-bold text-primary">ELAW</span>
                <span className="ml-2 text-sm text-muted-foreground">학습지원 / 취업연계 플랫폼</span>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              <Link href="#learning" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                학습
              </Link>
              <Link href="#career" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                취업
              </Link>
              <Link href="#events" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                대회/이벤트
              </Link>
              <Link href="#ai-curriculum" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                AI 커리큘럼
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">로그인</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">회원가입</Button>
              </Link>
            </div>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="relative overflow-hidden py-20 md:py-32">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
            <div className="container relative mx-auto px-4">
              <div className="mx-auto max-w-3xl text-center">
                <Badge variant="secondary" className="mb-4">
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI 기반 맞춤형 학습
                </Badge>
                <h1 className="mb-6 text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                  공과대학 <span className="text-primary">학습</span>과{" "}
                  <span className="text-primary">취업</span>을 한번에
                </h1>
                <p className="mx-auto mb-8 max-w-2xl text-pretty text-lg text-muted-foreground">
                  AI가 분석한 맞춤형 커리큘럼으로 전공 학습부터 취업 준비까지.
                  ELAW와 함께 당신의 성장을 시작하세요.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link href="/register">
                    <Button size="lg" className="gap-2">
                      무료로 시작하기
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="gap-2">
                    <Play className="h-4 w-4" />
                    서비스 소개 영상
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
                {/* [FE 수정 매뉴얼] 아래 25,000+ 같은 통계 숫자들도 API를 통해 동적으로 받아오도록 수정할 수 있습니다. */}
                {/* [BE/DB 매뉴얼] 시스템 전체 사용자 수, 전체 강의 수 등의 Count 쿼리를 모아서 반환하는 API가 유용합니다. */}
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">25,000+</p>
                  <p className="text-sm text-muted-foreground">등록 학생</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">500+</p>
                  <p className="text-sm text-muted-foreground">제공 강의</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">150+</p>
                  <p className="text-sm text-muted-foreground">파트너 기업</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">92%</p>
                  <p className="text-sm text-muted-foreground">취업 성공률</p>
                </div>
              </div>
            </div>
          </section>

          {/* Learning Section */}
          <section id="learning" className="border-t py-20">
            <div className="container mx-auto px-4">
              <div className="mb-12 text-center">
                <Badge variant="outline" className="mb-4">
                  <BookOpen className="mr-1 h-3 w-3" />
                  학과별 학습
                </Badge>
                <h2 className="mb-4 text-3xl font-bold">전공 학습 시스템</h2>
                <p className="mx-auto max-w-2xl text-muted-foreground">
                  공과대학 모든 학과의 전공 강의, 문제풀이, 시험을 한 곳에서
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* [FE 수정 매뉴얼] 위에서 정의한 departments 배열(또는 API 데이터)을 돌면서 카드 UI를 생성합니다. */}
                {departments.map((dept) => (
                    <Card key={dept.name} className="group cursor-pointer transition-all hover:border-primary hover:shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{dept.name}</CardTitle>
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {dept.courses}개 강좌
                      </span>
                          <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                            {dept.students.toLocaleString()}명
                      </span>
                        </div>
                      </CardContent>
                    </Card>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link href="/dashboard">
                  <Button variant="outline" className="gap-2">
                    전체 학과 보기
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Career Section */}
          <section id="career" className="border-t bg-muted/30 py-20">
            <div className="container mx-auto px-4">
              <div className="mb-12 text-center">
                <Badge variant="outline" className="mb-4">
                  <Building2 className="mr-1 h-3 w-3" />
                  취업 연계
                </Badge>
                <h2 className="mb-4 text-3xl font-bold">기업 매칭 시스템</h2>
                <p className="mx-auto max-w-2xl text-muted-foreground">
                  학습 데이터 기반 AI 매칭으로 나에게 맞는 기업을 찾아보세요
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* [FE 수정 매뉴얼] companies 배열 데이터를 순회하여 기업 카드 생성 */}
                {companies.map((company) => (
                    <Card key={company.name} className="group cursor-pointer transition-all hover:border-primary hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                          {company.logo}
                        </div>
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        <CardDescription>{company.field}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="h-4 w-4 text-primary" />
                          <span className="font-medium text-primary">{company.positions}개</span>
                          <span className="text-muted-foreground">채용 중</span>
                        </div>
                      </CardContent>
                    </Card>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link href="/dashboard">
                  <Button variant="outline" className="gap-2">
                    전체 기업 보기
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Events Section */}
          <section id="events" className="border-t py-20">
            <div className="container mx-auto px-4">
              <div className="mb-12 text-center">
                <Badge variant="outline" className="mb-4">
                  <Trophy className="mr-1 h-3 w-3" />
                  성장 기회
                </Badge>
                <h2 className="mb-4 text-3xl font-bold">대회 및 이벤트</h2>
                <p className="mx-auto max-w-2xl text-muted-foreground">
                  실력을 검증하고 성장할 수 있는 다양한 대회와 프로그램
                </p>
              </div>

              <div className="mx-auto max-w-3xl space-y-4">
                {/* [FE 수정 매뉴얼] events 배열 데이터를 순회하여 이벤트 리스트 생성 */}
                {events.map((event) => (
                    <Card key={event.title} className="group cursor-pointer transition-all hover:border-primary hover:shadow-lg">
                      <CardContent className="flex items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <span className="text-xs">D-</span>
                            <span className="text-lg font-bold">{event.dDay}</span>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{event.type}</Badge>
                            </div>
                            <h3 className="font-semibold">{event.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              <Award className="mr-1 inline h-3 w-3" />
                              상금 {event.prize}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                      </CardContent>
                    </Card>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link href="/dashboard">
                  <Button variant="outline" className="gap-2">
                    전체 이벤트 보기
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* AI Curriculum Section */}
          <section id="ai-curriculum" className="border-t bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20">
            <div className="container mx-auto px-4">
              <div className="grid items-center gap-12 lg:grid-cols-2">
                <div>
                  <Badge variant="outline" className="mb-4">
                    <Brain className="mr-1 h-3 w-3" />
                    AI 학습 추천
                  </Badge>
                  <h2 className="mb-4 text-3xl font-bold">
                    AI가 설계하는<br />
                    <span className="text-primary">맞춤형 커리큘럼</span>
                  </h2>
                  <p className="mb-6 text-muted-foreground">
                    방대한 전공 학습 내용을 AI가 분석하여 당신의 수준과 목표에 맞는
                    최적의 학습 경로를 제시합니다. 효율적인 자기개발 학습을 시작하세요.
                  </p>
                  <ul className="mb-8 space-y-3">
                    <li className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                        <TrendingUp className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">실력 분석 기반 맞춤 학습 계획</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                        <Clock className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">주 단위 학습 목표 및 진도 관리</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                        <Calendar className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">시험 일정에 맞춘 복습 추천</span>
                    </li>
                  </ul>
                  <Link href="/curriculum">
                    <Button size="lg" className="gap-2">
                      AI 커리큘럼 시작하기
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {/* [FE/BE 설명] 우측 샘플 학습 현황 UI 영역 (정적 데이터) */}
                <div className="rounded-2xl border bg-card p-6 shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">나의 학습 현황</h3>
                    <Badge variant="secondary">AI 분석 중</Badge>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>자료구조</span>
                        <span className="text-primary">85%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-[85%] rounded-full bg-primary" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>알고리즘</span>
                        <span className="text-primary">62%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-[62%] rounded-full bg-primary" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>운영체제</span>
                        <span className="text-primary">45%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-[45%] rounded-full bg-primary" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>데이터베이스</span>
                        <span className="text-primary">28%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-[28%] rounded-full bg-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-lg bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Sparkles className="h-4 w-4" />
                      AI 추천: 알고리즘 심화 학습 권장
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="border-t py-20">
            <div className="container mx-auto px-4">
              <Card className="overflow-hidden bg-primary text-primary-foreground">
                <CardContent className="flex flex-col items-center justify-center gap-6 p-12 text-center">
                  <GraduationCap className="h-12 w-12" />
                  <h2 className="text-3xl font-bold">지금 바로 시작하세요</h2>
                  <p className="max-w-xl text-primary-foreground/80">
                    ELAW와 함께 체계적인 전공 학습과 취업 준비를 동시에.
                    AI 커리큘럼으로 효율적인 성장을 경험하세요.
                  </p>
                  <div className="flex gap-4">
                    <Link href="/register">
                      <Button size="lg" variant="secondary">
                        무료 회원가입
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button size="lg" variant="outline" className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                        로그인
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>

        {/* Footer */}
        {/* [FE 수정 매뉴얼] Footer의 Link 태그 href 속성들을 추후 올바른 URL 경로로 수정 필요 */}
        <footer className="border-t bg-card py-12">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <GraduationCap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-lg font-bold text-primary">ELAW</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  공과대학 학습지원 및 취업연계 플랫폼
                </p>
              </div>
              <div>
                <h4 className="mb-3 font-semibold">학습</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground">전공 강의</Link></li>
                  <li><Link href="#" className="hover:text-foreground">문제풀이</Link></li>
                  <li><Link href="#" className="hover:text-foreground">모의시험</Link></li>
                  <li><Link href="#" className="hover:text-foreground">AI 커리큘럼</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 font-semibold">취업</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground">기업 정보</Link></li>
                  <li><Link href="#" className="hover:text-foreground">채용 공고</Link></li>
                  <li><Link href="#" className="hover:text-foreground">AI 매칭</Link></li>
                  <li><Link href="#" className="hover:text-foreground">이력서 관리</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-3 font-semibold">커뮤니티</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground">대회/이벤트</Link></li>
                  <li><Link href="#" className="hover:text-foreground">스터디</Link></li>
                  <li><Link href="#" className="hover:text-foreground">멘토링</Link></li>
                  <li><Link href="#" className="hover:text-foreground">Q&A</Link></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
              <p>&copy; 2024 ELAW. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
  )
}