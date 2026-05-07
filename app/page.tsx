import Link from "next/link";

const features = [
  {
    href: "/daily-report",
    icon: "📋",
    title: "일일 업무보고",
    description: "오늘 수행한 업무, 진행 중인 업무, 내일 예정 업무를 AI가 체계적으로 정리해드립니다.",
    color: "from-blue-50 to-blue-100",
    border: "border-blue-200",
    textColor: "text-blue-700",
    btnColor: "bg-blue-600 hover:bg-blue-700",
  },
  {
    href: "/weekly-report",
    icon: "📅",
    title: "주간 업무보고",
    description: "한 주간의 업무 실적과 다음 주 계획을 AI가 전문적인 보고서 형식으로 작성합니다.",
    color: "from-purple-50 to-purple-100",
    border: "border-purple-200",
    textColor: "text-purple-700",
    btnColor: "bg-purple-600 hover:bg-purple-700",
  },
  {
    href: "/meeting-minutes",
    icon: "📝",
    title: "회의록",
    description: "회의 내용, 결정 사항, 후속 조치를 AI가 체계적인 공식 회의록으로 정리합니다.",
    color: "from-green-50 to-green-100",
    border: "border-green-200",
    textColor: "text-green-700",
    btnColor: "bg-green-600 hover:bg-green-700",
  },
  {
    href: "/report",
    icon: "📊",
    title: "보고서",
    description: "다양한 유형의 업무 보고서를 AI가 전문적이고 체계적으로 작성합니다.",
    color: "from-orange-50 to-orange-100",
    border: "border-orange-200",
    textColor: "text-orange-700",
    btnColor: "bg-orange-600 hover:bg-orange-700",
  },
  {
    href: "/email",
    icon: "✉️",
    title: "이메일",
    description: "업무 이메일을 정중하고 전문적으로 작성합니다. 요청, 안내, 감사 등 다양한 유형 지원.",
    color: "from-red-50 to-red-100",
    border: "border-red-200",
    textColor: "text-red-700",
    btnColor: "bg-red-600 hover:bg-red-700",
  },
];

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="text-6xl mb-4">🤖</div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          AI 사무 자동화
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          AI를 이용해 업무보고, 회의록, 보고서, 이메일 등<br />
          사무적인 문서를 <strong className="text-blue-600">더 빠르고 간편하게</strong> 작성하세요.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-500">
          <span className="bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm">✅ 전문적인 문서 자동 생성</span>
          <span className="bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm">⚡ 수 초 내 완성</span>
          <span className="bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm">📋 복사 & 다운로드 지원</span>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.href}
            className={"bg-gradient-to-br " + feature.color + " border " + feature.border + " rounded-2xl p-6 flex flex-col"}
          >
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h2 className={"text-xl font-bold " + feature.textColor + " mb-2"}>
              {feature.title}
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-4">
              {feature.description}
            </p>
            <Link
              href={feature.href}
              className={feature.btnColor + " text-white text-sm font-semibold py-2.5 px-4 rounded-xl text-center transition-colors"}
            >
              시작하기 →
            </Link>
          </div>
        ))}
      </div>

      {/* How to use */}
      <div className="mt-20 bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">사용 방법</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "1", icon: "📝", title: "정보 입력", desc: "필요한 업무 정보를 간단하게 입력합니다." },
            { step: "2", icon: "🤖", title: "AI 자동 생성", desc: "AI가 전문적인 문서를 자동으로 작성합니다." },
            { step: "3", icon: "📤", title: "복사 & 활용", desc: "생성된 문서를 복사하거나 다운로드하여 활용합니다." },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                {item.step}
              </div>
              <div className="text-3xl mb-2">{item.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup notice */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
          <span>⚙️</span> 시작 전 설정
        </h3>
        <p className="text-sm text-amber-700">
          이 서비스는 OpenAI API를 사용합니다.{" "}
          <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">.env.local</code> 파일에{" "}
          <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">OPENAI_API_KEY</code>를 설정해야 합니다.{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            API 키 발급 →
          </a>
        </p>
      </div>
    </div>
  );
}
