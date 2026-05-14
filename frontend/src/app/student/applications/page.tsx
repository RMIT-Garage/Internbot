export default function Page() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 antialiased">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="fixed flex h-full w-64 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center space-x-3 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B91C1C] font-bold text-white">
              R
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#B91C1C]">Internbot</h1>
              <p className="text-[10px] tracking-widest text-gray-500 uppercase">
                Academic Curator
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {['Overview', 'Applications', 'Semesters', 'AI Advisor', 'Settings'].map((item, i) => (
              <a
                key={item}
                href="#"
                className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition ${
                  item === 'Applications'
                    ? 'border-r-4 border-[#B91C1C] bg-red-50 text-[#B91C1C]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="space-y-3 border-t border-gray-100 p-6 text-sm text-gray-500">
            <a className="block hover:text-gray-700">Help Center</a>
            <a className="block hover:text-gray-700">Logout</a>
          </div>
        </aside>

        {/* MAIN WRAPPER */}
        <div className="ml-64 flex flex-1 flex-col">
          {/* HEADER */}
          <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
            <div className="relative w-[420px]">
              <input
                className="w-full rounded-xl bg-gray-100 py-2 pr-4 pl-10 text-sm focus:ring-2 focus:ring-[#B91C1C] focus:outline-none"
                placeholder="Search internships..."
              />
              <span className="absolute top-2.5 left-3 text-gray-400">⌕</span>
            </div>

            <nav className="hidden space-x-8 text-sm md:flex">
              <a className="border-b-2 border-[#B91C1C] pb-4 font-semibold text-[#B91C1C]">
                Dashboard
              </a>
              <a className="text-gray-600 hover:text-gray-900">Internships</a>
              <a className="text-gray-600 hover:text-gray-900">Messages</a>
              <a className="text-gray-600 hover:text-gray-900">Resources</a>
            </nav>

            <div className="flex items-center space-x-4">
              <div className="h-9 w-9 rounded-full bg-gray-200" />
            </div>
          </header>

          {/* CONTENT */}
          <main className="mx-auto w-full max-w-6xl p-10">
            {/* TITLE */}
            <div className="mb-10">
              <p className="text-xs tracking-widest text-gray-400 uppercase">
                Internships / Submission
              </p>
              <h1 className="mt-2 text-3xl font-bold">Submit Self-Sourced Internship</h1>
              <p className="mt-2 max-w-2xl text-gray-500">
                Provide employer and position details for verification and approval.
              </p>
            </div>

            <div className="grid grid-cols-12 gap-8">
              {/* LEFT */}
              <div className="col-span-12 space-y-6 lg:col-span-8">
                {/* CARD */}
                <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                  <h2 className="mb-6 text-xs font-bold tracking-widest text-[#B91C1C] uppercase">
                    Company Details
                  </h2>

                  <div className="space-y-5">
                    <Input label="Employer Name" placeholder="Atlassian, Canva..." />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Job Title" placeholder="Software Engineer Intern" />
                      <Input label="Website" placeholder="https://company.com" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                  <h2 className="mb-6 text-xs font-bold tracking-widest text-[#B91C1C] uppercase">
                    Position Description
                  </h2>

                  <Textarea
                    label="Role Description & Responsibilities"
                    placeholder="Describe responsibilities, tools, projects..."
                  />
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                  <h2 className="mb-6 text-xs font-bold tracking-widest text-[#B91C1C] uppercase">
                    Work Details
                  </h2>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <Label>Work Mode</Label>
                      <div className="flex rounded-xl bg-gray-100 p-1">
                        {['Onsite', 'Hybrid', 'Remote'].map((m) => (
                          <button
                            key={m}
                            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                              m === 'Hybrid' ? 'bg-[#B91C1C] text-white' : 'hover:bg-white'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Input label="Location" placeholder="Melbourne, VIC" />
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="col-span-12 space-y-6 lg:col-span-4">
                {/* AI CARD */}
                <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold">Gemini Advisor</h3>
                  <p className="mt-1 text-xs tracking-widest text-gray-500 uppercase">
                    AI Suitability Check
                  </p>

                  <div className="mt-6 rounded-xl border-l-4 border-[#B91C1C] bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 italic">Review in progress...</p>
                    <div className="mt-3 h-1 overflow-hidden rounded bg-gray-200">
                      <div className="h-full w-1/2 bg-[#B91C1C]" />
                    </div>
                  </div>

                  <button className="mt-6 w-full rounded-xl bg-[#B91C1C] py-3 font-semibold text-white transition hover:bg-red-800">
                    Run Suitability Check
                  </button>
                </div>

                {/* UPLOAD */}
                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <h3 className="text-xs font-bold tracking-widest uppercase">Contract Upload</h3>

                  <div className="mt-5 rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-sm font-semibold text-[#B91C1C]">Upload or drag & drop</p>
                    <p className="mt-1 text-xs text-gray-400">PDF, DOCX supported</p>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="space-y-3">
                  <button className="w-full rounded-xl bg-[#B91C1C] py-4 text-xs font-bold tracking-widest text-white uppercase hover:bg-red-800">
                    Submit for Review
                  </button>
                  <button className="w-full rounded-xl border border-gray-200 bg-white py-4 text-xs font-bold tracking-widest uppercase hover:bg-gray-50">
                    Save Draft
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

/* Small UI helpers */
function Label({ children }: any) {
  return (
    <label className="mb-2 block text-[10px] font-bold tracking-widest text-gray-400 uppercase">
      {children}
    </label>
  )
}

function Input({ label, ...props }: any) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        {...props}
        className="w-full rounded-xl bg-gray-100 px-4 py-3 text-sm focus:ring-2 focus:ring-[#B91C1C] focus:outline-none"
      />
    </div>
  )
}

function Textarea({ label, ...props }: any) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        {...props}
        rows={6}
        className="w-full resize-none rounded-xl bg-gray-100 px-4 py-3 text-sm focus:ring-2 focus:ring-[#B91C1C] focus:outline-none"
      />
    </div>
  )
}
