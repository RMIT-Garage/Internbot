export default function Page() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 p-10">
      {/* HEADER */}
      <div className="mb-12 space-y-4">
        <nav className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase">
          <span className="text-slate-400">Internships</span>
          <span className="text-slate-300">/</span>
          <span className="text-rose-700">Self-Sourced Submission</span>
        </nav>

        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Submit Self-Sourced Internship
        </h2>

        <p className="max-w-3xl leading-relaxed text-slate-500">
          Provide employer and role details for coordinator verification. Approved submissions
          become visible opportunities across your semester.
        </p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-12 gap-10">
        {/* LEFT FORM */}
        <div className="col-span-8 space-y-8">
          {/* STEP 1 */}
          <section className="relative rounded-3xl border border-slate-100 bg-white p-9 shadow-sm transition hover:shadow-md">
            <div className="absolute top-6 right-6 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-600">
              Step 01
            </div>

            <h3 className="mb-1 text-sm font-bold text-slate-900">Company Details</h3>

            <p className="mb-8 text-xs text-slate-400">
              Basic information about the employer and role
            </p>

            <div className="space-y-7">
              {/* Employer */}
              <div>
                <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Employer Name
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. Atlassian, Canva"
                />
              </div>

              {/* Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Job Title
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                    placeholder="Software Engineer Intern"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Website
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                    placeholder="https://company.com"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2 */}
          <section className="relative rounded-3xl border border-slate-100 bg-white p-9 shadow-sm transition hover:shadow-md">
            <div className="absolute top-6 right-6 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-600">
              Step 02
            </div>

            <h3 className="mb-1 text-sm font-bold text-slate-900">Position Description</h3>

            <p className="mb-8 text-xs text-slate-400">
              Describe responsibilities, tools, and learning outcomes
            </p>

            <textarea
              rows={6}
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-4 text-sm transition outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              placeholder="Detail your daily tasks, projects, technologies, and team structure..."
            />
          </section>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="col-span-4 space-y-6">
          {/* AI CARD */}
          <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow">
                ⚡
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">Gemini Advisor</h4>
                <p className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">
                  AI Suitability Check
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Reviewing submission...
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                <div className="h-full w-1/2 rounded-full bg-rose-600" />
              </div>
            </div>

            <button className="w-full rounded-2xl bg-rose-600 py-4 font-bold text-white shadow-md transition hover:bg-rose-700 active:scale-[0.98]">
              Run Suitability Check
            </button>

            <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
              Evaluates alignment with SE/CS curriculum requirements.
            </p>
          </div>

          {/* UPLOAD */}
          <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
            <h4 className="mb-2 text-xs font-bold tracking-wider text-slate-900 uppercase">
              Contract Upload
            </h4>

            <p className="mb-5 text-[11px] text-slate-400">
              Upload offer letter or internship contract (PDF preferred)
            </p>

            {/* HIDDEN INPUT */}
            <input id="contract-upload" type="file" className="hidden" accept=".pdf,.doc,.docx" />

            {/* LABEL = BUTTON */}
            <label
              htmlFor="contract-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-rose-100 bg-rose-50/30 p-10 text-center transition hover:bg-rose-50"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center text-2xl text-rose-500">
                📄
              </div>

              <p className="text-sm font-semibold text-slate-700">Click to upload file</p>

              <p className="mt-1 text-[11px] text-slate-400">PDF, DOCX up to 10MB</p>
            </label>
          </div>
        </div>
      </div>
    </main>
  )
}
