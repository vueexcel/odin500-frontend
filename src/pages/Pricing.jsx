import React, { useState } from 'react';
import { Check, X, Focus, Lock, Plus } from 'lucide-react';

const OdinPricingPage = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const plans = [
    {
      name: "Basic (Free)",
      price: "0",
      save: null,
      features: [
        { text: "Market insights", included: true },
        { text: "Basic signals", included: true },
        { text: "Dow Jones Signals", included: false },
        { text: "Nasdaq-100 Signals", included: false },
        { text: "SP500 Signals", included: false },
        { text: "Selected ETFs Signals", included: false },
        { text: "Odin Trading Signals", included: false },
      ],
      buttonText: "Start free"
    },
    {
      name: "Premium",
      price: isAnnual ? "31" : "39",
      save: "Save $100 a year",
      features: [
        { text: "Market insights", included: true },
        { text: "Basic signals", included: true },
        { text: "Dow Jones Signals", included: true },
        { text: "Nasdaq-100 Signals", included: true },
        { text: "SP500 Signals", included: false },
        { text: "Selected ETFs Signals", included: false },
        { text: "Odin Trading Signals", included: false },
      ],
      buttonText: "Start 30-day trial"
    },
    {
      name: "Pro",
      price: isAnnual ? "66" : "79",
      save: "Save $150 a year",
      badge: "Most popular",
      isPro: true,
      features: [
        { text: "Market insights", included: true },
        { text: "Basic signals", included: true },
        { text: "Dow Jones Signals", included: true },
        { text: "Nasdaq-100 Signals", included: true },
        { text: "SP500 Signals", included: true },
        { text: "Selected ETFs Signals", included: true },
        { text: "Odin Trading Signals", included: false },
      ],
      buttonText: "Start 30-day trial"
    },
    {
      name: "Ultimate",
      price: isAnnual ? "149" : "179",
      save: "Save $150 a year",
      features: [
        { text: "Market insights", included: true },
        { text: "Basic signals", included: true },
        { text: "Dow Jones Signals", included: true },
        { text: "Nasdaq-100 Signals", included: true },
        { text: "SP500 Signals", included: true },
        { text: "Selected ETFs Signals", included: true },
        { text: "Odin Trading Signals", included: true },
      ],
      buttonText: "Get full access"
    }
  ];

  const whyFeatures = [
    "Daily actionable\nsignals",
    "Systematic data\ndriven approach",
    "Designed to outperform\nbuy-and-hold strategies",
    "Long / short signals - benefit from\ndifferent market conditions",
    "Coverage across S&P 500,\nNasdaq-100, and key ETFs",
    "Enhanced\nMarket Anlytics" // Typo maintained from Figma image
  ];

  const faqs = [
    {
      q: "What do I get with a subscription?",
      intro:
        "You get full access to daily Odin Signals across all covered tickers (S&P 500, Nasdaq-100, Dow Jones, and leading ETFs), including:",
      points: [
        "Daily signals for covered tickers",
        "Coverage across S&P 500, Nasdaq-100, Dow Jones, and major ETFs",
        "Historical signal performance and return analytics",
        "Advanced market data views and return analysis"
      ]
    },
    {
      q: "What's the difference between Ticker Signals and Odin Trading Signals?",
      body: [
        "Odin Ticker Signals are generated daily for each covered ticker using proprietary quantitative methodologies that analyze price action, trends, and statistical patterns.",
        "Odin Trading Signals are separate signals used for Odin sample portfolio accounts. These sample accounts include a limited number of strategy-specific trading signals for each account."
      ]
    },
    {
      q: "What are Odin Sample Portfolio Accounts?",
      body: [
        "Odin Sample Portfolio Accounts are demo accounts that illustrate how Odin signals can be deployed under different trading strategies.",
        "Some accounts are focused on ETF/index deployment, while others emphasize specific factor-sensitive strategies. Performance is compared against the most relevant underlying benchmark."
      ]
    },
    {
      q: "How are Odin Signals generated?",
      body: [
        "Odin Signals are generated using proprietary quantitative methodologies that evaluate price action, trends, and statistical patterns across each ticker.",
        "The system is designed to identify, on a daily basis, higher-probability long and short opportunities."
      ]
    },
    {
      q: "What do the signals (L1, L2, L3, S1, S2, S3) mean?",
      points: [
        "L1 / S1: Strongest conviction signals",
        "L2 / S2: Moderate signals",
        "L3 / S3: Early or weaker signals",
        "N (neutral): No clear edge"
      ],
      outro: "This structure helps you adjust position sizing and risk level."
    },
    {
      q: "Is this suitable for beginners?",
      intro: "Yes, but with context. Odin500 is best for:",
      points: [
        "Active traders who want structured signals as an additional decision-support tool",
        "Investors looking to enhance returns versus buy-and-hold strategies"
      ],
      outro: "Market understanding and trading experience are highly recommended."
    },
    {
      q: "Does this guarantee profits?",
      body: [
        "No. Like any trading methodology, there are no guarantees that signals will generate positive returns on every trade or over every period.",
        "Odin signals are designed as an additional decision-support layer, not as a replacement for your own investment decisions or risk preferences."
      ]
    },
    {
      q: "How often are signals updated?",
      body: [
        "Signals are updated daily for every covered ticker.",
        "You always have access to the latest signal state across the full universe."
      ]
    },
    {
      q: "Can I use this for long-term investing or only trading?",
      intro: "Both.",
      points: [
        "Active traders can use signals for entry/exit timing",
        "Long-term investors can use signals to optimize allocations and reduce drawdowns"
      ],
      outro: "Odin signals are not designed for day-trading or high-frequency strategies."
    },
    {
      q: "What markets are covered?",
      points: [
        "S&P 500 stocks",
        "Nasdaq-100 stocks",
        "Dow Jones stocks",
        "Major index ETFs (e.g., SPY, QQQ, DIA)",
        "S&P 500 sector ETFs",
        "Commodity ETFs (e.g., GLD, SLV, USO, UNG)"
      ]
    },
    {
      q: "Can I cancel anytime?",
      body: ["Yes. You can cancel your subscription at any time. Access remains active until the end of your current billing cycle."]
    },
    {
      q: "Do you offer a free trial or preview?",
      body: ["Yes. Limited access preview is available so you can evaluate signal quality before subscribing."]
    },
    {
      q: "How is this different from other signal providers?",
      intro: "Odin500 is built around:",
      points: [
        "Full market coverage (not just a few picks)",
        "Consistent daily signals for every ticker",
        "Structured signal-strength system",
        "Integrated data, analytics, ticker signals, and trading signals in one platform"
      ]
    },
    {
      q: "Do I need to connect a broker?",
      body: [
        "No. Odin500 is an independent decision-support platform.",
        "You can execute trades using any broker you prefer."
      ]
    },
    {
      q: "Is there historical performance data?",
      intro: "Yes. You can view:",
      points: [
        "Historical signal performance",
        "Monthly and annual return analytics",
        "Comparative performance versus buy-and-hold"
      ]
    },
    {
      q: "Who is this built for?",
      points: [
        "Active traders",
        "Data-driven investors",
        "Users who want systematic signals as an additional decision-support tool"
      ]
    }
  ];

  const leftFaqs = faqs.filter((_, i) => i % 2 === 0);
  const rightFaqs = faqs.filter((_, i) => i % 2 === 1);

  const renderFaqCard = (faq, index) => (
    <div
      key={index}
      className="bg-[#e8edf5]/80 hover:bg-[#e1e7f0]  backdrop-blur-sm transition-colors rounded-[14px] overflow-hidden dark:bg-slate-900/55 dark:hover:bg-slate-800/70"
    >
      <button onClick={() => toggleFaq(index)} className="w-full px-5 py-[18px] flex justify-between items-center text-left">
        <span className="font-semibold text-[#334155] dark:text-slate-100 text-[13px] pr-4">{faq.q}</span>
        <Plus className={`w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-45' : ''}`} />
      </button>

      {openFaq === index && (
        <div className="px-5 pb-5 text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed border-t border-slate-200/60 dark:border-white/[0.06] pt-3">
          {faq.intro ? <p className="mb-2">{faq.intro}</p> : null}
          {Array.isArray(faq.body)
            ? faq.body.map((line, lineIdx) => (
                <p key={lineIdx} className={lineIdx > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))
            : null}
          {Array.isArray(faq.points) && faq.points.length ? (
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {faq.points.map((point, pointIdx) => (
                <li key={pointIdx}>{point}</li>
              ))}
            </ul>
          ) : null}
          {faq.outro ? <p className="mt-2">{faq.outro}</p> : null}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] dark:bg-[#020617] overflow-hidden font-sans pb-16 dark:pb-8">
      
      {/* --- GLOBAL BACKGROUND ELEMENTS --- */}
      {/* Vertical Grid Lines spanning the whole page */}
      <div className="absolute top-0 left-[15%] w-[1px] h-full bg-white/60 dark:bg-white/[0.06] pointer-events-none z-0" />
      <div className="absolute top-0 right-[15%] w-[1px] h-full bg-white/60 dark:bg-white/[0.06] pointer-events-none z-0" />
      
      {/* Horizontal Grid Line (Top) */}
      <div className="absolute top-[120px] left-0 w-full h-[1px] bg-white/60 dark:bg-white/[0.06] pointer-events-none z-0" />

      {/* Radial Blue Glows */}
      <div className="absolute top-[0%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#3b82f6]/10 dark:bg-[#3b82f6]/25 blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#3b82f6]/20 dark:bg-[#60a5fa]/30 blur-[80px] rounded-full pointer-events-none z-0" />


      {/* ========================================================= */}
      {/* SECTION 1: HERO & PRICING                                */}
      {/* ========================================================= */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-4 pt-20 pb-16">
        
        {/* Headers */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-[#4388fc] dark:text-[#60a5fa] font-bold text-2xl mb-1 tracking-wide">
            Trade Smarter
          </h2>
          <h1 className="text-[3.4rem] leading-tight font-extrabold text-[#0f172a] dark:text-white mb-6 tracking-tight">
            Unlock The Signals
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed px-4 sm:px-10">
            Access Odin Quant Signals for SP500, Nasdaq-100,<br className="hidden sm:block" />
            {' '}Dow Jones, and selected ETFs. Choose the plan that<br className="hidden sm:block" />
            {' '}fits your current needs and trading style.
          </p>
        </div>

        {/* Pricing Toggle Switch */}
        <div className="flex justify-center items-center gap-4 mb-14">
          <div className="bg-[#e4ecfa] dark:bg-slate-900/90 dark:ring-1 dark:ring-white/10 p-1 rounded-full flex items-center shadow-sm dark:shadow-[0_0_24px_rgba(0,0,0,0.45)] relative z-10 gap-[13px]">
            <div 
              className={`absolute top-1 bottom-1 w-[90px] bg-[#2b73fe] dark:bg-[#3b82f6] rounded-full transition-transform duration-300 ease-in-out shadow-[0_4px_12px_rgba(43,115,254,0.4)] dark:shadow-[0_0_20px_rgba(59,130,246,0.55)] ${isAnnual ? 'translate-x-[90px]' : 'translate-x-0'}`} 
            />
            <button 
              onClick={() => setIsAnnual(false)}
              className={`relative z-10 w-[90px] py-2 text-[13px] font-semibold transition-colors duration-300 ${!isAnnual ? 'text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setIsAnnual(true)}
              className={`relative z-10 w-[90px] py-2 text-[13px] font-semibold transition-colors duration-300 ${isAnnual ? 'text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              Annually
            </button>
          </div>
          <span className="text-[#4388fc] dark:text-[#60a5fa] font-medium text-xs">(Save 20%)</span>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 px-4 lg:px-12">
          {plans.map((plan, idx) => (
            <div 
              key={idx}
              className={`relative flex flex-col pt-8 pb-8 px-7 rounded-[28px] transition-all duration-300
                ${plan.isPro 
                  ? 'bg-[#ebf1f9] border-2 border-[#4388fc] shadow-lg scale-[1.02] z-20 dark:bg-white/[0.06] dark:border-[#3b82f6] dark:shadow-[0_0_32px_rgba(59,130,246,0.35)] dark:backdrop-blur-md' 
                  : 'bg-[#ebf1f9] border border-transparent shadow-sm z-10 dark:bg-white/[0.05] dark:border-white/[0.08] dark:shadow-none dark:backdrop-blur-sm'
                }
              `}
            >
              {plan.badge && (
                <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-4 py-[6px] rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-100 shadow-md dark:shadow-[0_0_16px_rgba(59,130,246,0.25)] dark:ring-1 dark:ring-white/10 whitespace-nowrap z-30">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6 relative">
                <h3 className="text-[#0f172a] dark:text-white font-bold text-[15px] mb-3">{plan.name}</h3>
                
                <div className="absolute -top-2 right-0 w-11 h-11 rounded-full bg-[#dbe6f8] dark:bg-[#3b82f6]/20 flex items-center justify-center border border-white/50 dark:border-[#3b82f6]/40">
                   <Focus className="w-5 h-5 text-[#4388fc] dark:text-[#60a5fa]" />
                </div>

                <div className="flex items-baseline gap-1 mt-6">
                  <span className="text-[2.5rem] font-extrabold text-[#0f172a] dark:text-white">${plan.price}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">/ mo</span>
                </div>
                
                <div className="h-5 mt-1">
                  {plan.save && <p className="text-[#4388fc] dark:text-[#60a5fa] font-semibold text-[13px]">{plan.save}</p>}
                </div>
              </div>

              <ul className="space-y-[14px] mb-10 flex-grow">
                {plan.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center 
                      ${feat.included ? 'bg-[#2b73fe] dark:bg-[#3b82f6]' : 'bg-[#cbd5e1] dark:bg-slate-600'}`}
                    >
                        {feat.included ? (
                        <Check strokeWidth={3} className="w-[10px] h-[10px] text-white" />
                        ) : (
                        <X strokeWidth={3} className="w-[10px] h-[10px] text-slate-500 dark:text-slate-300" />
                        )}
                    </div>
                    <span className={`text-[13px] font-semibold tracking-tight 
                      ${feat.included ? 'text-[#0f172a] dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
                    >
                      {feat.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button className="w-full bg-[#2b73fe] hover:bg-[#1d5ee0] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb] text-white py-[14px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_12px_24px_-6px_rgba(43,115,254,0.6)] dark:shadow-[0_0_22px_rgba(59,130,246,0.5),0_12px_24px_-8px_rgba(59,130,246,0.45)] transition-all">
                <Lock className="w-4 h-4 fill-white text-white opacity-80" />
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </section>


      {/* ========================================================= */}
      {/* SECTION 2: WHY ODIN500 & FAQS                             */}
      {/* ========================================================= */}
      <section className="relative z-10 max-w-[1000px] mx-auto px-4 pt-24">
        
        {/* --- Why Odin500? --- */}
        <div className="relative mb-32">
          
          {/* Concentric Circles Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] pointer-events-none z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-blue-200/40 dark:border-[#3b82f6]/25 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] border border-blue-200/30 dark:border-[#3b82f6]/18 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-blue-200/20 dark:border-[#3b82f6]/12 rounded-full" />
          </div>

          <h2 className="text-[2.2rem] font-extrabold text-[#0f172a] dark:text-white text-center mb-10 relative z-10">
            Why Odin500?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] relative z-10">
            {whyFeatures.map((text, i) => (
              <div 
                key={i} 
                className="bg-white/70 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-xl p-5 flex items-center justify-center min-h-[100px] text-center dark:bg-white/[0.05] dark:border-white/[0.1] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
              >
                <p className="text-[#334155] dark:text-slate-300 font-semibold text-[13px] leading-[1.4] whitespace-pre-line">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>


        {/* --- Frequently Asked Questions --- */}
        <div className="relative mb-20">
          
          {/* Bottom Radial Glow for FAQ section */}
          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-white/40 dark:bg-[#3b82f6]/12 blur-[100px] rounded-full pointer-events-none z-0" />

          <h2 className="text-[2.2rem] font-extrabold text-[#0f172a] dark:text-white text-center mb-10 relative z-10">
            Frequently Asked Questions
          </h2>
          
          <div className="grid items-start grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3 relative z-10 px-4 md:px-0">
            <div className="flex flex-col gap-3">
              {leftFaqs.map((faq, localIdx) => renderFaqCard(faq, localIdx * 2))}
            </div>
            <div className="flex flex-col gap-3">
              {rightFaqs.map((faq, localIdx) => renderFaqCard(faq, localIdx * 2 + 1))}
            </div>
          </div>
        </div>

        {/* --- Bottom CTA (light: centered) --- */}
        <div className="relative text-center pb-12 z-20 dark:hidden">
            <div className="absolute top-1/2 left-[-50vw] w-[200vw] h-[1px] bg-white/60 pointer-events-none -z-10" />

            <button className="bg-[#2b73fe] hover:bg-[#1d5ee0] text-white px-14 py-[14px] rounded-xl font-bold text-sm shadow-[0_12px_24px_-6px_rgba(43,115,254,0.6)] transition-all">
                Try for free
            </button>
            <p className="mt-4 text-[11px] text-slate-500 font-medium">
                No card required.
            </p>
        </div>

        {/* --- Bottom CTA + strip (dark: Figma) --- */}
        <div className="relative z-20 mx-auto max-w-[1000px] pb-10 pt-4 hidden dark:block">
          <div className="text-center mb-10">
            <button
              type="button"
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-14 py-[14px] rounded-xl font-bold text-sm shadow-[0_0_22px_rgba(59,130,246,0.45),0_12px_24px_-8px_rgba(59,130,246,0.4)] transition-all"
            >
              Try for free
            </button>
            <p className="mt-4 text-[11px] text-slate-400 font-medium">No credit card required</p>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-t border-white/[0.08] pt-8 px-1">
            <p className="text-center sm:text-left text-[15px] font-semibold text-white sm:max-w-[55%]">
              Ready to revolutionize your outreach?
            </p>
            <button
              type="button"
              className="shrink-0 bg-[#3b82f6] hover:bg-[#2563eb] text-white px-10 py-[14px] rounded-xl font-bold text-sm shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all self-center sm:self-auto"
            >
              Try for free
            </button>
          </div>
        </div>

      </section>
    </div>
  );
};

export default OdinPricingPage;