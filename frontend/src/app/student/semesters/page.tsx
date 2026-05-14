export default function Page() {
  return (
    <div className="h-full bg-gray-50 font-sans text-gray-900">
      <div className="flex h-full min-h-screen">
        {/* Left Sidebar */}
        <aside className="flex w-64 flex-shrink-0 flex-col justify-between border-r border-gray-200 bg-gray-50 px-4 py-6">
          <div>
            {/* Logo */}
            <div className="mb-10 flex items-center space-x-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-700 text-white">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm leading-tight font-bold text-gray-900">Internbot</h1>
                <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                  Academic Curator
                </p>
              </div>
            </div>

            {/* Nav */}
            <nav className="space-y-1">
              <a
                className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                href="#"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Overview</span>
              </a>

              <a
                className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                href="#"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Applications</span>
              </a>

              <a
                className="flex items-center space-x-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                href="#"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Semesters</span>
              </a>

              <a
                className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                href="#"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9.663 17h4.674a1 1 0 00.922-.617l2.108-4.742A1 1 0 0016.445 10H14.5l.75-4.25a1 1 0 00-1.745-.968l-6 8A1 1 0 008.5 14.5h1.914l-.75 4.25a1 1 0 00.999 1.25z" />
                </svg>
                <span>AI Advisor</span>
              </a>

              <a
                className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                href="#"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </a>
            </nav>
          </div>

          <div className="space-y-1">
            <a
              className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              href="#"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Help Center</span>
            </a>

            <a
              className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              href="#"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </a>
          </div>
        </aside>

        {/* Main */}
        <div className="flex h-screen flex-1 flex-col overflow-hidden bg-white">
          {/* Header */}
          <header className="z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
            <div className="w-96">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  className="block w-full rounded-lg border-none bg-gray-100 py-2 pr-3 pl-10 text-sm placeholder-gray-500 focus:ring-0"
                  placeholder="Search internships..."
                  type="text"
                />
              </div>
            </div>

            <nav className="flex h-full space-x-8">
              <a
                className="inline-flex items-center border-b-2 border-red-600 px-1 pt-1 text-sm font-medium text-red-600"
                href="#"
              >
                Dashboard
              </a>
              <a
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700"
                href="#"
              >
                Internships
              </a>
              <a
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700"
                href="#"
              >
                Messages
              </a>
              <a
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-700"
                href="#"
              >
                Resources
              </a>
            </nav>

            <div className="flex items-center space-x-6">
              <button className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>

              <button className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </button>

              <div className="h-8 w-8 overflow-hidden rounded-full border border-gray-200">
                <img
                  alt="User Profile"
                  className="h-full w-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdspApCON1Ap371x18cglHR6U6SIHlsimyUFKuiSPSR30JoeWz30y7nqdQagu0FDHByp5aE0S4zWmyLx3i7mng9I0bTlLOA7-FevxO3M8rotNu_A2LojMF8bFdiNDsVrM9C5wn6g_X51leESbARUz2_RWV3bUnsaz6PDOkQOm593gwHRm7eX_1C5T03z4E6WZK2jbdnjVFb5JFSlQlHwk_1tcRDJuYgx7CVnkDiToQDlPvfmacQoNEDd05zd9uXHwaStlMm93_9w"
                />
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto bg-white p-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row">
              {/* Left */}
              <div className="flex-1 space-y-8">
                <section>
                  <span className="mb-3 inline-block rounded bg-gray-100 px-3 py-1 text-[10px] font-bold tracking-widest text-gray-600 uppercase">
                    Eligibility Confirmed
                  </span>
                  <h2 className="mb-4 text-4xl font-extrabold text-gray-900">
                    Select Your Semester
                  </h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
                    Your profile, including GPA and credit points, has been verified. Please select
                    the semester you intend to start your internship to proceed with your position
                    description submission.
                  </p>
                </section>

                <section className="flex items-start space-x-4 rounded-r-xl border-l-4 border-blue-500 bg-blue-50/50 p-6">
                  <svg
                    className="h-6 w-6 rotate-12 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
                  </svg>

                  <div className="text-sm">
                    <h4 className="mb-1 font-bold text-gray-900">Teaching Period Advisory</h4>
                    <p className="leading-relaxed text-gray-600">
                      Selecting your semester now reserves your placement spot and ensures your
                      internship timeline aligns with the academic calendar. We recommend{' '}
                      <span className="font-semibold text-blue-600">Semester 1 2026</span>.
                    </p>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="relative cursor-pointer rounded-xl border-2 border-red-500 bg-white p-6 shadow-sm">
                    <div className="absolute top-4 right-4">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>

                    <span className="mb-4 inline-block rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase">
                      Recommended
                    </span>

                    <h3 className="mb-2 text-xl font-bold text-gray-900">Semester 1 2026</h3>

                    <div className="mb-6 space-y-2">
                      <div className="flex items-center text-xs font-medium text-gray-500">
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Course Code: <span className="ml-1 text-gray-900">INTE2710</span>
                      </div>

                      <div className="flex items-center text-xs font-medium text-gray-500">
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Feb 15 - Mar 30
                      </div>
                    </div>

                    <div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full w-[75%] bg-red-500" />
                      </div>
                      <div className="mt-1 text-[10px] font-medium text-gray-400">
                        75% Enrollment Capacity reached
                      </div>
                    </div>
                  </div>

                  <div className="relative cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-gray-300">
                    <div className="absolute top-4 right-4">
                      <div className="h-5 w-5 rounded-full border-2 border-gray-200" />
                    </div>

                    <span className="mb-4 inline-block rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400 uppercase">
                      Available
                    </span>

                    <h3 className="mb-2 text-xl font-bold text-gray-900">Semester 2 2026</h3>

                    <div className="mb-6 space-y-2">
                      <div className="flex items-center text-xs font-medium text-gray-500">
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Course Code: <span className="ml-1 text-gray-900">INTE2710</span>
                      </div>

                      <div className="flex items-center text-xs font-medium text-gray-500">
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Jul 15 - Aug 30
                      </div>
                    </div>

                    <div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full w-[12%] bg-gray-400" />
                      </div>
                      <div className="mt-1 text-[10px] font-medium text-gray-400">
                        12% Enrollment Capacity reached
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-100 bg-gray-50/50 p-8">
                  <h4 className="mb-4 text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                    Additional Student Note (Optional)
                  </h4>
                  <textarea
                    className="w-full resize-none rounded-xl border-gray-200 text-sm placeholder-gray-400 focus:border-red-500 focus:ring-red-500"
                    rows={4}
                    placeholder="Enter any specific requests or scheduling notes for your academic advisor..."
                  />
                </section>
              </div>

              {/* Right */}
              <div className="w-full space-y-6 lg:w-[320px]">
                <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h3 className="mb-6 text-lg font-bold text-gray-900">Selection Summary</h3>

                  <div className="mb-8 space-y-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Selected Term</span>
                      <span className="font-bold text-gray-900">Sem 1 2026</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Course Credits</span>
                      <span className="font-bold text-gray-900">24 CP</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Eligibility</span>
                      <span className="font-bold tracking-wide text-green-500 uppercase">
                        Verified
                      </span>
                    </div>
                  </div>

                  <button className="w-full rounded-xl bg-[#e11d48] py-4 font-bold text-white shadow-md shadow-red-100 transition-colors hover:bg-[#be123c]">
                    Confirm Semester &amp; Proceed
                  </button>

                  <p className="mt-4 px-4 text-center text-[11px] leading-relaxed text-gray-400">
                    By confirming, you proceed to the next stage of the internship workflow. Ensure
                    your selection matches your graduation timeline.
                  </p>
                </section>

                <section className="rounded-xl bg-[#e0e7ff] p-6">
                  <div className="mb-3 flex items-center space-x-2 text-indigo-900">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-sm font-bold">Next Steps</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-indigo-700">
                    Once your semester is confirmed, you will gain access to the Internship
                    application module where you can submit position descriptions for approval.
                  </p>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
