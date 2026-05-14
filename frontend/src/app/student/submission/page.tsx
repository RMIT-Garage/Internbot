export default function Page() {
  return (
    <>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Internbot - Submission Successful</title>

          <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

          <style
            dangerouslySetInnerHTML={{
              __html: `
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body {
                font-family: 'Inter', sans-serif;
              }
            `,
            }}
          />

          <style
            dangerouslySetInnerHTML={{
              __html: `
              :root {
                --internbot-red: #C4001A;
                --internbot-bg: #F9F9F9;
                --card-border: #E5E7EB;
              }
              .text-internbot-red { color: var(--internbot-red); }
              .bg-internbot-red { background-color: var(--internbot-red); }
              .border-internbot-red { border-color: var(--internbot-red); }
            `,
            }}
          />
        </head>

        <body className="flex min-h-screen flex-col bg-[#FDFDFD] text-slate-800">
          {/* NAV */}
          <nav className="flex items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
            <div className="flex items-center gap-12">
              <div className="flex items-center text-xl font-bold">
                <span className="text-internbot-red">Intern</span>
                <span className="text-gray-600">bot</span>
              </div>

              <div className="flex items-center gap-8 text-sm font-medium text-gray-500">
                <a className="hover:text-gray-900" href="#">
                  Dashboard
                </a>
                <a className="text-internbot-red border-internbot-red border-b-2 pb-1" href="#">
                  Applications
                </a>
                <a className="hover:text-gray-900" href="#">
                  Internships
                </a>
              </div>
            </div>

            <div className="flex items-center gap-6 text-gray-400">
              <button className="hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>

              <button className="hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>

              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#0E4F52] text-white">
                <img
                  alt="User Profile"
                  className="h-full w-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvIxLX5KKWY_7bcp1-X7OOqze6rbFBIdCd6i8VSBVtJpcnE7t1h7anCGYyXU9kN7eK9ElmFQz98OwuJOg9jHlmeN7p83EpZq2KUfbXpCN8ML9Z1w3p-TigrFtngcxugwhz6ZVhzYbf3fHV6OnybW0_fvVHsEKHgsQ2AnjWPeN6vkCup-13RDEhDNhQE8wKj1F-9CksG7saeUbSaYllZAP9gNf-IatnLB-WqVbgdViMhHojJsO8ZKr6LdR0lylu1VAqF8VRoKVUOQ"
                />
              </div>
            </div>
          </nav>

          {/* MAIN */}
          <main className="mx-auto w-full max-w-6xl flex-grow px-8 py-12">
            {/* HEADER */}
            <section className="mb-10">
              <div className="mb-6">
                <div className="bg-internbot-red flex h-12 w-12 items-center justify-center rounded-lg">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                    />
                  </svg>
                </div>
              </div>

              <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-gray-900">
                Submission Successful
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-gray-500">
                Your internship application for{' '}
                <span className="font-semibold text-gray-700">Alex Chen (s3829104)</span> has been
                received and is now in the review queue.
              </p>
            </section>

            {/* GRID */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* LEFT */}
              <div className="space-y-8 lg:col-span-7">
                {/* Submission ID */}
                <div className="border-internbot-red rounded-r-xl border-y border-r border-l-4 border-gray-100 bg-white p-8 shadow-sm">
                  <div className="text-internbot-red mb-6 inline-block rounded bg-red-50 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">
                    Submission ID: RMIT-2024-8842
                  </div>

                  <div className="grid grid-cols-2 gap-y-8">
                    <div>
                      <p className="mb-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                        Employer
                      </p>

                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-black">
                          <img
                            alt="Atlassian"
                            className="h-5 w-5"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4JBTAPo8pi02gKnUE1vTGgSU4bf3klCGFQUxVfeBcuMUmewoULXqDyTJ78a655GIOomEkvHI6y64FXF3kNz0-AqQzTWAk2jahxjBTmva5fIbOmOchOb6Wsj8IbhQ_PUJd1J0NAZWhEtNpwYH_7bdec15kCULzYI1IIOyfnOLkLth6sMFbr4X4lVOt-j3LvJ0XeuYtosa9yninLBdK0Xsfxd6ByGJs_DgYa6DiaNflkpBJw5crLZAiBjbB_GrRtznnUTVZmk177A"
                          />
                        </div>
                        <span className="text-xl font-bold text-gray-800">Atlassian</span>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                        Role
                      </p>
                      <span className="text-xl font-bold text-gray-800">UX Design Intern</span>
                    </div>

                    <div>
                      <p className="mb-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                        Source Type
                      </p>
                      <div className="flex items-center gap-2 font-semibold text-gray-700">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                          />
                        </svg>
                        <span>Self-Sourced</span>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                        Date Filed
                      </p>
                      <div className="flex items-center gap-2 font-semibold text-gray-700">
                        <svg
                          className="h-4 w-4"
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
                        <span>Oct 25, 2024</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8">
                  <div className="mb-10 flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    <h2 className="text-xl font-bold text-gray-800">Next Steps</h2>
                  </div>

                  <div className="relative space-y-0">
                    <div className="absolute top-2 bottom-2 left-3 w-0.5 bg-gray-200"></div>

                    {/* Step 1 */}
                    <div className="relative flex gap-6 pb-10">
                      <div className="bg-internbot-red relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-white">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">Submission Received</h3>
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-blue-600 uppercase">
                          Completed
                        </span>
                        <p className="text-sm text-gray-400">Oct 25, 2024</p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="relative flex gap-6 pb-10">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white">
                        <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">AI Advisor Scan</h3>
                        <span className="rounded bg-blue-600 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                          In Progress
                        </span>
                        <p className="text-sm text-gray-500">
                          Automated role suitability and contract compliance check.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="relative flex gap-6 pb-10">
                      <div className="h-6 w-6 rounded-full bg-gray-200" />
                      <div>
                        <h3 className="font-bold text-gray-400">Coordinator Review</h3>
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-[9px] font-bold text-gray-500 uppercase">
                          Pending
                        </span>
                        <p className="text-sm text-gray-400">
                          Manual verification by Dr. Aris Roberts. Typically takes 3-5 business
                          days.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="relative flex gap-6">
                      <div className="h-6 w-6 rounded-full bg-gray-200" />
                      <div>
                        <h3 className="font-bold text-gray-400">Final Decision</h3>
                        <p className="text-sm text-gray-400">
                          You will be notified via email once approved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="space-y-6 lg:col-span-5">
                {/* Advisor Note */}
                <div className="flex gap-4 rounded-lg border-l-4 border-blue-500 bg-[#F0F7FB] p-6">
                  <div className="mt-1">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </div>

                  <div>
                    <h4 className="mb-2 text-[10px] font-bold tracking-widest text-blue-900 uppercase">
                      Academic Advisor Note
                    </h4>
                    <p className="text-sm leading-relaxed font-medium text-blue-700">
                      Your application meets the initial criteria for the Design Industry Practicum.
                      The AI advisor has flagged your contract for immediate review due to the
                      reputable employer status of Atlassian.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                  <button className="bg-internbot-red mb-6 flex w-full items-center justify-center gap-3 rounded-lg py-4 font-bold text-white transition-colors hover:bg-red-700">
                    <span>Return to Dashboard</span>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M4 6h16M4 12h8m-8 6h16"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                  </button>

                  <button className="text-internbot-red mb-8 w-full font-bold hover:underline">
                    View My Applications
                  </button>

                  <p className="text-xs text-gray-400">
                    Need help?{' '}
                    <a className="underline" href="#">
                      Contact Support
                    </a>
                  </p>
                </div>

                {/* Illustration */}
                <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#449185]">
                  <img
                    alt="Student success illustration"
                    className="h-full w-full object-cover opacity-80 mix-blend-multiply"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBXifO-x7DN1Nn1YZjYaMDu9307FySc0Wbpz3fW573MynrB2XNuDMwhH1zWHCzd1XDK9fmp-Nj_qEpMbQF8ugwxzQUOWzwUHjY3iHv-P5MPesFMQOh9POV30__P9RP3gdfMOZC7il1di4N-MV70esX4YSCIR-5-AHJwysNcRLhmK9uv7DFgyaK_HfdthrGvyT-IpOJUfdhk1SexHFgeewhYBj5WzlzDhMLwN4-YcRpd_8mOvbTuB-0bbhMvPhar2Wsu5UNnRDnkg"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  <div className="absolute right-6 bottom-6 left-6">
                    <p className="text-lg leading-snug font-bold text-white">
                      94% of RMIT students found their internship within 2 weeks of submission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* FOOTER */}
          <footer className="border-t border-gray-100 bg-white px-8 py-8">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                <span className="font-bold text-gray-800">Internbot</span>
                <span className="text-gray-300">|</span>
                <span>Institutional Precision</span>
              </div>

              <div className="flex items-center gap-8 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                <a className="hover:text-gray-600" href="#">
                  Privacy Policy
                </a>
                <a className="hover:text-gray-600" href="#">
                  Academic Integrity
                </a>
                <a className="hover:text-gray-600" href="#">
                  RMIT Support
                </a>
              </div>
            </div>
          </footer>
        </body>
      </html>
    </>
  )
}
