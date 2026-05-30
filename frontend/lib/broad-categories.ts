export const BROAD_CATEGORY_RULES: [string, string[]][] = [
  ["테스팅 & QA", [
    "Testing", "QA", "Quality Assurance", "Test Automation", "Defect",
  ]],
  ["데이터 & AI/ML", [
    "Machine Learning", "Deep Learning", "NLP", "Natural Language", "Computer Vision",
    "Generative AI", "Generative Model", "LLM", "MLOps", "Data Science",
    "Data Engineering", "Data Pipeline", "Data Processing", "Data Management",
    "Big Data", "Analytics", "Feature Engineering", "Vector DB", "Vector Database",
    "RAG", "Reinforcement Learning", "Distributed Training", "Model Training",
    "Model Serving", "Active Learning", "Evaluation Metric", "Tokenization",
    "Information Retrieval",
  ]],
  ["네트워크", [
    "Network", "Networking", "TCP", "HTTP", "DNS", "Routing", "VLAN", "VPN",
    "Wireless", "CDN", "NAT", "Ethernet", "Switching", "IPv6", "ARP", "ICMP",
    "Layer 2", "Layer 3", "Transport Layer", "QoS", "Multicast", "Subnetting",
    "Connectivity", "Communication",
  ]],
  ["데이터베이스", [
    "Database", "SQL", "NoSQL", "RDBMS", "Data Modeling", "Data Warehouse",
    "Replication", "Transaction", "Data Storage", "Databases",
  ]],
  ["클라우드 & 인프라", [
    "Cloud", "Infrastructure", "DevOps", "Kubernetes", "Docker", "Container",
    "CI/CD", "IaC", "Serverless", "Deployment", "Orchestration", "Automation",
    "Infrastructure as Code", "Monitoring", "Observability", "SRE",
    "Site Reliability", "DevSecOps", "Infra", "System Design", "Distributed System",
    "Distributed Processing", "Operations", "Reliability", "High Availability",
    "Disaster Recovery", "Auto Scaling", "Chaos Engineering", "Messaging",
    "Message Queue", "Message Broker", "Load Balancing", "Microservices",
    "Operation & Monitoring", "Performance", "Storage",
  ]],
  ["보안", [
    "Security", "Cryptography", "Privacy", "Compliance", "Vulnerability",
    "Incident Response", "Identity and Access", "IAM", "DDoS", "Intrusion",
    "Audit", "Governance",
  ]],
  ["웹 개발", [
    "Frontend", "CSS", "HTML", "JavaScript", "TypeScript", "React", "DOM",
    "Browser", "UI", "UX", "Web", "Responsive", "Animation",
    "State Management", "Micro Frontend", "Mobile", "iOS", "Android",
  ]],
  ["백엔드 & API", [
    "Backend", "API", "Server", "Spring Boot", "REST API",
  ]],
  ["운영체제 & 시스템", [
    "OS", "Operating System", "Linux", "Memory", "Hardware", "Embedded",
    "Firmware", "Kernel", "Virtualization", "Sensor", "Electronics",
    "Power", "Battery", "IoT", "ROS", "Physics", "Kinematics", "Navigation",
  ]],
  ["프로그래밍 & 알고리즘", [
    "Algorithm", "Data Structure", "Logic", "OOP", "Clean Code",
    "Code Quality", "Software Engineering", "Software Design", "Software Quality",
    "Software", "Math", "Mathematics", "Design Pattern", "CS Foundation",
    "Basic Theory", "Programming", "Scripting", "Git", "Version Control",
    "Architecture", "System", "Language", "General",
  ]],
]

export const BROAD_CATEGORY_ORDER = [
  "프로그래밍 & 알고리즘",
  "웹 개발",
  "백엔드 & API",
  "데이터베이스",
  "데이터 & AI/ML",
  "네트워크",
  "클라우드 & 인프라",
  "보안",
  "운영체제 & 시스템",
  "테스팅 & QA",
  "기타",
] as const

export const BROAD_CATEGORY_COLORS: Record<string, string> = {
  "프로그래밍 & 알고리즘": "border-violet-300 bg-violet-50 text-violet-700",
  "웹 개발":              "border-indigo-300 bg-indigo-50 text-indigo-700",
  "백엔드 & API":         "border-blue-300 bg-blue-50 text-blue-700",
  "데이터베이스":          "border-amber-300 bg-amber-50 text-amber-700",
  "데이터 & AI/ML":       "border-purple-300 bg-purple-50 text-purple-700",
  "네트워크":             "border-cyan-300 bg-cyan-50 text-cyan-700",
  "클라우드 & 인프라":     "border-teal-300 bg-teal-50 text-teal-700",
  "보안":                 "border-red-300 bg-red-50 text-red-700",
  "운영체제 & 시스템":     "border-slate-300 bg-slate-50 text-slate-700",
  "테스팅 & QA":          "border-pink-300 bg-pink-50 text-pink-700",
  "기타":                 "border-gray-300 bg-gray-50 text-gray-700",
}

export function mapToBroadCategory(cat: string): string {
  for (const [broad, keywords] of BROAD_CATEGORY_RULES) {
    if (keywords.some((kw) => cat.toLowerCase().includes(kw.toLowerCase()))) {
      return broad
    }
  }
  return "기타"
}

const KO_EN_TECH: [string, string][] = [
  ["딥러닝", "deep learning"], ["머신러닝", "machine learning"],
  ["자연어 처리", "natural language processing"], ["자연어처리", "natural language processing"],
  ["컴퓨터 비전", "computer vision"], ["컴퓨터비전", "computer vision"],
  ["강화학습", "reinforcement learning"], ["추천 시스템", "recommendation system"],
  ["자료구조", "data structure"], ["운영체제", "operating system"],
  ["스프링 부트", "spring boot"], ["스프링부트", "spring boot"],
  ["캐싱", "caching"], ["메시지 큐", "message queue"], ["메시징", "messaging"],
  ["트랜잭션", "transaction"], ["리액트", "react"], ["타입스크립트", "typescript"],
  ["자바스크립트", "javascript"], ["상태 관리", "state management"],
  ["데이터베이스", "database"], ["데이터 웨어하우스", "data warehouse"],
  ["데이터 파이프라인", "data pipeline"], ["데이터 엔지니어링", "data engineering"],
  ["쿠버네티스", "kubernetes"], ["컨테이너", "container"], ["도커", "docker"],
  ["클라우드", "cloud"], ["배포", "deployment"], ["인프라", "infrastructure"],
  ["마이크로서비스", "microservices"], ["아키텍처", "architecture"],
  ["보안", "security"], ["네트워크", "network"], ["암호화", "cryptography"],
  ["모니터링", "monitoring"], ["임베디드", "embedded"], ["모바일", "mobile"],
  ["알고리즘", "algorithm"], ["동시성", "concurrency"],
  ["시스템 설계", "system design"], ["분산", "distributed system"],
]

function translateTheme(theme: string): string {
  let text = theme.toLowerCase()
  for (const [ko, en] of KO_EN_TECH) {
    text = text.replaceAll(ko, en)
  }
  return text
}

/** 주차 테마 → 실제 문제가 존재하는 대분류 목록 반환 */
export function getWeekBroadCategories(
  theme: string,
  problems: { category: string }[]
): string[] {
  if (problems.length === 0) return []

  const themeEn = translateTheme(theme)
  const themeText = " " + themeEn + " " + theme.toLowerCase() + " "

  const themeBroads = new Set<string>()
  for (const [broad, keywords] of BROAD_CATEGORY_RULES) {
    if (keywords.some((kw) => themeText.includes(kw.toLowerCase()))) {
      themeBroads.add(broad)
    }
  }

  const existingBroads = new Set(problems.map((p) => mapToBroadCategory(p.category)))
  return BROAD_CATEGORY_ORDER.filter((b) => themeBroads.has(b) && existingBroads.has(b))
}
