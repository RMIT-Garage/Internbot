export default function Page() {
  return (
    <>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Internbot - Submit Self-Sourced Internship</title>

          {/* Tailwind CSS v3 with Plugins */}
          <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

          {/* Google Fonts: Inter */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />

          <style
            dangerouslySetInnerHTML={{
              __html: `
              body {
                font-family: 'Inter', sans-serif;
                background-color: #F8F9FA;
              }
              .active-nav-item {
                background-color: #FEE2E2;
                color: #B91C1C;
                border-right: 4px solid #B91C1C;
              }
              .internbot-red {
                background-color: #B91C1C;
              }
              .text-internbot-red {
                color: #B91C1C;
              }
              .form-input-bg {
                background-color: #E5E7EB;
              }
              .shadow-card {
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
              }
            `,
            }}
          />
        </head>

        <body className="text-gray-900 antialiased">
          <div className="flex min-h-screen">
            {/* BEGIN: Sidebar */}
            <aside
              className="fixed flex h-full w-64 flex-col border-r border-gray-200 bg-white"
              data-purpose="sidebar"
            >
              <div className="flex items-center space-x-3 p-6">
                <div className="internbot-red flex h-8 w-8 items-center justify-center rounded text-lg font-bold text-white">
                  R
                </div>
                <div>
                  <h1 className="text-internbot-red text-sm leading-tight font-bold">Internbot</h1>
                  <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                    Academic Curator
                  </p>
                </div>
              </div>

              <nav className="mt-4 flex-1">
                <ul className="space-y-1">
                  <li>
                    <a
                      className="flex items-center px-6 py-3 text-gray-600 transition-colors hover:bg-gray-50"
                      href="#"
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <span className="text-sm font-medium">Overview</span>
                    </a>
                  </li>

                  <li>
                    <a className="active-nav-item flex items-center px-6 py-3" href="#">
                      <svg
                        className="mr-3 h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <span className="text-sm font-medium">Applications</span>
                    </a>
                  </li>

                  <li>
                    <a
                      className="flex items-center px-6 py-3 text-gray-600 transition-colors hover:bg-gray-50"
                      href="#"
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <span className="text-sm font-medium">Semesters</span>
                    </a>
                  </li>

                  <li>
                    <a
                      className="flex items-center px-6 py-3 text-gray-600 transition-colors hover:bg-gray-50"
                      href="#"
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <span className="text-sm font-medium">AI Advisor</span>
                    </a>
                  </li>

                  <li>
                    <a
                      className="flex items-center px-6 py-3 text-gray-600 transition-colors hover:bg-gray-50"
                      href="#"
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                        <path
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      <span className="text-sm font-medium">Settings</span>
                    </a>
                  </li>
                </ul>
              </nav>

              <div className="space-y-4 border-t border-gray-100 p-6">
                <a className="flex items-center text-sm text-gray-500 hover:text-gray-700" href="#">
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Help Center
                </a>

                <a className="flex items-center text-sm text-gray-500 hover:text-gray-700" href="#">
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Logout
                </a>
              </div>
            </aside>

            {/* Main Content */}
            <div className="ml-64 flex h-screen flex-1 flex-col overflow-hidden">
              {/* Header */}
              <header className="z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
                <div className="relative w-96">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </span>
                  <input
                    className="focus:ring-internbot-red block w-full rounded-lg border-none bg-gray-100 py-2 pr-3 pl-10 text-sm focus:ring-2"
                    placeholder="Search internships..."
                    type="text"
                  />
                </div>

                <nav className="flex items-center space-x-8">
                  <a
                    className="text-internbot-red border-internbot-red -mb-5 border-b-2 pb-5 text-sm font-semibold"
                    href="#"
                  >
                    Dashboard
                  </a>
                  <a className="text-sm font-medium text-gray-600 hover:text-gray-900" href="#">
                    Internships
                  </a>
                  <a className="text-sm font-medium text-gray-600 hover:text-gray-900" href="#">
                    Messages
                  </a>
                  <a className="text-sm font-medium text-gray-600 hover:text-gray-900" href="#">
                    Resources
                  </a>
                </nav>

                <div className="flex items-center space-x-6">
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </button>

                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                      <path
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </button>

                  <div className="h-10 w-10 overflow-hidden rounded-full border border-gray-200">
                    <img
                      alt="User Profile"
                      className="h-full w-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeSE3-8zlLsdt0zZM50RIXDyF27Sv_X1jfm_9JATkSCfSloRY_IkZTQDqQydqLMFSSfC5N5sETT6MRWFVP9ZDqiFTUoNjYdUEvnfIDydK1cDs7h_0fPN24z7-Yq0zRMqB5ItvloOBdJGCPd07Yzd7zuybGfWEw7QTdWqKoPMjRY83WHdtNJ6zUGF3EZjpsywvTj1fhJZ1It8_PUxDiDowF3xW5Rr-U5akNZYYKYCNXEi2Sq6n6xRIMDCjAjZl4TUV9ajq3G-6azA"
                    />
                  </div>
                </div>
              </header>

              {/* Main */}
              <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-8">
                <div className="mx-auto max-w-6xl">
                  {/* Breadcrumb */}
                  <div className="mb-8">
                    <nav
                      aria-label="Breadcrumb"
                      className="mb-2 flex text-[11px] font-bold tracking-widest text-gray-400 uppercase"
                    >
                      <ol className="flex items-center space-x-1">
                        <li>
                          <a className="hover:text-gray-600" href="#">
                            Internships
                          </a>
                        </li>
                        <li>
                          <span className="mx-1">/</span>
                        </li>
                        <li className="text-internbot-red">Self-Sourced Submission</li>
                      </ol>
                    </nav>

                    <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-gray-900">
                      Submit Self-Sourced Internship
                    </h2>
                    <p className="text-lg text-gray-500">
                      Provide employer and position details for coordinator verification. Approved
                      submissions become visible opportunities for all students in your semester.
                    </p>
                  </div>

                  <div className="grid grid-cols-12 items-start gap-8">
                    {/* Left */}
                    <div className="col-span-12 space-y-6 lg:col-span-8">
                      {/* Company */}
                      <section className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-8">
                          <h3 className="text-internbot-red text-xs font-black tracking-widest uppercase">
                            01. Company Details
                          </h3>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <label className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                              Employer Name
                            </label>
                            <input
                              className="form-input-bg focus:ring-internbot-red w-full rounded-lg border-none p-4 text-gray-700 placeholder-gray-400 focus:ring-2"
                              placeholder="e.g. Atlassian, Canva"
                              type="text"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Job Title
                              </label>
                              <input
                                className="form-input-bg focus:ring-internbot-red w-full rounded-lg border-none p-4 text-gray-700 placeholder-gray-400 focus:ring-2"
                                placeholder="Software Engineer Intern"
                                type="text"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Website
                              </label>
                              <input
                                className="form-input-bg focus:ring-internbot-red w-full rounded-lg border-none p-4 text-gray-700 placeholder-gray-400 focus:ring-2"
                                placeholder="https://company.com"
                                type="text"
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Position */}
                      <section className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-8">
                          <h3 className="text-internbot-red text-xs font-black tracking-widest uppercase">
                            02. Position Description
                          </h3>
                        </div>

                        <div>
                          <label className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                            Role Description &amp; Responsibilities
                          </label>
                          <textarea
                            className="form-input-bg focus:ring-internbot-red w-full resize-none rounded-lg border-none p-4 text-gray-700 placeholder-gray-400 focus:ring-2"
                            placeholder="Detail your daily tasks, projects, and technologies you will be working with..."
                            rows={6}
                          />
                        </div>
                      </section>

                      {/* Work */}
                      <section className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                        <div className="mb-8">
                          <h3 className="text-internbot-red text-xs font-black tracking-widest uppercase">
                            03. Work Details
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <label className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                              Work Mode
                            </label>

                            <div className="flex space-x-1 rounded-lg border border-gray-200 p-1">
                              <button className="flex-1 rounded py-2 text-xs font-bold transition-colors hover:bg-gray-100">
                                Onsite
                              </button>
                              <button className="internbot-red flex-1 rounded py-2 text-xs font-bold text-white">
                                Hybrid
                              </button>
                              <button className="flex-1 rounded py-2 text-xs font-bold transition-colors hover:bg-gray-100">
                                Remote
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                              Location
                            </label>

                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg
                                  className="h-4 w-4 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                  />
                                  <path
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                  />
                                </svg>
                              </span>

                              <input
                                className="form-input-bg focus:ring-internbot-red w-full rounded-lg border-none p-4 pl-10 text-gray-700 placeholder-gray-400 focus:ring-2"
                                placeholder="City, State"
                                type="text"
                              />
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>

                    {/* Right */}
                    <div className="col-span-12 space-y-6 lg:col-span-4">
                      {/* Advisor */}
                      <div
                        className="shadow-card relative overflow-hidden rounded-xl border border-red-100 bg-white p-6"
                        data-purpose="ai-check-panel"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <svg
                            className="h-24 w-24 text-blue-500"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
                          </svg>
                        </div>

                        <div className="mb-6 flex items-center space-x-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                            <svg
                              className="h-6 w-6 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                              />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900">Gemini Advisor</h4>
                            <p className="text-[10px] font-black tracking-widest text-blue-600 uppercase">
                              AI SUITABILITY CHECK
                            </p>
                          </div>
                        </div>

                        <div className="border-internbot-red mb-6 rounded-lg border-l-4 bg-gray-50 p-4">
                          <p className="mb-2 text-sm text-gray-600 italic">
                            "Review in progress..."
                          </p>
                          <div className="h-1 w-8 overflow-hidden rounded-full bg-red-200">
                            <div className="internbot-red h-full w-1/2"></div>
                          </div>
                        </div>

                        <button className="internbot-red flex w-full items-center justify-center space-x-2 rounded-xl py-4 font-bold text-white shadow-lg transition-colors hover:bg-red-800">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Run Suitability Check</span>
                        </button>

                        <p className="mt-4 px-6 text-center text-[10px] leading-relaxed text-gray-400">
                          Our AI agent evaluates role relevance against RMIT's SE and CS curriculum.
                        </p>
                      </div>

                      {/* Upload */}
                      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h4 className="mb-4 text-xs font-black tracking-widest text-gray-800 uppercase">
                          Contract Upload
                        </h4>
                        <p className="mb-6 text-xs leading-relaxed text-gray-500">
                          Official Offer Letter / Contract (PDF preferred)
                        </p>

                        <div className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-8 transition-colors hover:bg-red-100">
                          <svg
                            className="mb-3 h-8 w-8 text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                            />
                          </svg>
                          <span className="text-internbot-red mb-2 text-[11px] font-black tracking-widest uppercase">
                            Upload Document
                          </span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase">
                            OR DRAG AND DROP
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center space-x-3">
                            <div className="text-red-500">
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4a2 2 0 012-2h4.586A1 1 0 0111.293 2.707l4 4a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                              </svg>
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              internship_offer_letter.pdf
                            </span>
                          </div>

                          <button className="text-gray-300 hover:text-gray-500">
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-3">
                        <button className="internbot-red w-full rounded-xl py-5 text-xs font-bold tracking-widest text-white uppercase shadow-md transition-shadow hover:bg-red-800">
                          Submit for Coordinator Review
                        </button>

                        <button className="w-full rounded-xl border border-gray-200 bg-white py-5 text-xs font-bold tracking-widest text-gray-800 uppercase transition-colors hover:bg-gray-50">
                          Save Draft
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </body>
      </html>
    </>
  )
}
