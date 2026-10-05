import Link from "next/link";
import AppShell from "../components/app-shell";
import styles from "../workspace.module.css";

const rows = [
  ['20 Apr - 24 Apr', 'IT Support & User Assistance\nMicrosoft 365 Administration Support\nTechnical Troubleshooting & Remote Technical Assistance', '7.5', '202.50'],
  ['27 Apr - 1 May', 'No IT Related Issues Reported', '0.0', '0.00'],
  ['4 May - 8 May', 'General IT Support & Remote User Assistance', '2.0', '54.00'],
  ['11 May - 15 May', 'IT Support & System Assistance', '1.5', '40.50'],
  ['18 May - 22 May', 'User Support, Troubleshooting & Microsoft 365 Administration Support', '6.0', '162.00'],
  ['25 May - 29 May', 'General IT Support & Assistance', '1.0', '27.00'],
];

export default function Home() {
  return (
    <AppShell title="The original TCS sample" subtitle="An optional weekly invoice example. New invoices start with a flexible billing body.">
      <div className="mx-auto mb-10 flex max-w-[850px] flex-wrap items-center justify-between gap-6">
        <p className="text-sm text-[#b8a7c7]">Code Squad weekly services · AUD</p>
        <Link href="/create?template=tcs" className={styles.secondary}>Use this sample <span aria-hidden="true">↗</span></Link>
      </div>
      <article data-glow="true" aria-label="Sample Code Squad invoice" className="relative mx-auto max-w-[850px] overflow-hidden rounded-2xl border border-[#e4deed] bg-[#f8f5fc] text-[#24202d] shadow-xl">
        <div aria-hidden="true" className="relative h-32 overflow-hidden bg-gradient-to-r from-[#522494] to-[#8650d3]">
          <div className="absolute -top-5 left-4 size-40 rounded-full bg-white/15" />
          <div className="absolute -top-6 right-8 size-28 rounded-full bg-white/20" />
          <div className="relative ml-8 mt-7 grid size-16 place-items-center rounded-xl bg-white font-mono text-3xl font-bold text-[#522494]">{'</>'}</div>
        </div>
        <div className="p-5 sm:p-10">
          <header className="grid items-center gap-6 sm:grid-cols-[1fr_260px]">
            <div><h2 className="text-3xl font-extrabold tracking-tight">THE CODE SQUAD</h2><p className="mt-2 text-lg text-[#7240c4]">IT Support Services</p></div>
            <dl className="space-y-4 rounded-xl bg-[#7240c4] p-5 text-sm text-white">
              {[['Invoice #', '005'], ['Date', '3 June 2026'], ['Due Date', '10 June 2026']].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="font-bold">{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </header>
          <section aria-label="Customer details" className="mt-8 grid border border-[#d4c2ee] sm:grid-cols-2">
            {[['BILL TO', 'Education Embassy'], ['SERVICE LOCATION', '2/250 Orange Grove Rd, Salisbury']].map(([label, value], index) => <div key={label} className={index ? 'border-t border-[#d4c2ee] sm:border-t-0 sm:border-l' : ''}><h3 className="border-b border-[#d4c2ee] bg-[#eee6f7] px-4 py-3 text-xs font-bold text-[#522494]">{label}</h3><p className="px-4 py-4 text-sm">{value}</p></div>)}
          </section>
          <section className="mt-8" aria-labelledby="services-heading">
            <h3 id="services-heading" className="mb-4 text-xl font-bold text-[#522494]">Services Provided</h3>
            <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-purple-700" tabIndex={0} role="region" aria-label="Weekly services; scroll horizontally on small screens">
              <table className="w-full min-w-[650px] border-collapse text-xs leading-relaxed">
                <caption className="sr-only">Six weeks of IT services, 18 hours, A$486.00 total</caption>
                <thead><tr>{['Description', 'Details', 'Hours', 'Rate', 'Amount'].map((label, index) => <th key={label} scope="col" className={`border border-[#514959] bg-[#522494] px-3 py-3 text-white ${index > 1 ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr></thead>
                <tbody>{rows.map(([period, details, hours, amount]) => <tr key={period}>
                  <th scope="row" className="w-[23%] border border-[#514959] px-3 py-4 text-left align-top">Week: {period}</th>
                  <td className="w-[42%] whitespace-pre-line border border-[#514959] px-3 py-4 align-top">{details}</td>
                  {[hours, 'A$27.00', `A$${amount}`].map((value, index) => <td key={index} className="whitespace-nowrap border border-[#514959] px-3 py-4 text-right tabular-nums">{value}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </section>
          <div className="mt-5 grid items-start gap-5 sm:grid-cols-2">
            <section className="rounded-xl border border-[#d4c2ee] p-4"><h3 className="text-sm font-bold text-[#522494]">Notes</h3><p className="mt-2 text-xs leading-relaxed">Thank you for your business. Please make payment by the due date.</p></section>
            <dl className="border border-[#d4c2ee] text-sm font-bold">{[['Subtotal', 'A$486.00'], ['Tax (0%)', 'A$0.00'], ['Total Due', 'A$486.00']].map(([label, value], index) => <div key={label} className={`flex justify-between gap-4 px-4 py-3 ${index === 2 ? 'bg-[#7240c4] text-white' : 'border-b border-[#d4c2ee]'}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </div>
          <section className="mt-7"><h3 className="border-b border-[#d4c2ee] pb-2 font-bold text-[#522494]">Payment Details</h3><dl className="mt-3 space-y-1 text-xs">{[['Account Name', 'BHATTA RUSHEET'], ['BSB', 'Add in company settings'], ['Account Number', 'Add in company settings'], ['Business Identifier', 'To be confirmed']].map(([label, value]) => <div key={label} className="flex flex-wrap gap-x-2"><dt className="font-bold">{label}:</dt><dd>{value}</dd></div>)}</dl></section>
          <footer className="mt-8 flex justify-between gap-4 text-[10px] text-[#736580]"><span>THE CODE SQUAD · IT Support Services</span><span>Page 1</span></footer>
        </div>
      </article>
    </AppShell>
  );
}

