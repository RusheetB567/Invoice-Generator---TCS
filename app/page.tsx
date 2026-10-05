"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./landing.module.css";

const colours = [{name:"Squad violet",hex:"#7240c4"},{name:"Electric indigo",hex:"#515bea"},{name:"Forest",hex:"#257864"},{name:"Graphite",hex:"#34313e"}];
const features = [
  ["01", "CREATE", "Your work. Your way of billing.", "Write your scope, services, or project milestones in flexible sections. Add amounts and keep the totals in view.", "/create", "Open the creator"],
  ["02", "PERSONALISE", "Every detail. Unmistakably yours.", "Your logo, colour, business details, and payment instructions. A clean canvas for your own company.", "/settings", "Open brand studio"],
  ["03", "READ & REVIEW", "Paperwork. With a clearer future.", "Drop received invoices into your document inbox. Review the details, organise tax records, and export to Excel.", "/upload", "Open document inbox"],
];

export default function Home() {
  const [colour, setColour] = useState(colours[0].hex);
  const [motion, setMotion] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    const update = () => { frame = 0; const distance = document.documentElement.scrollHeight - innerHeight; progress.current?.style.setProperty("--progress", String(distance > 0 ? scrollY / distance : 0)); };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    update();
    const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.setAttribute("data-visible", "true"); observer.unobserve(entry.target); } }, { threshold: .12 });
    node.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
    node.dataset.ready = "true";
    return () => { observer.disconnect(); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); cancelAnimationFrame(frame); };
  }, []);
  function hover(event: PointerEvent<HTMLDivElement>) {
    if (!motion || event.pointerType === "touch" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    event.currentTarget.style.setProperty("--mouse-x", `${x * 100}%`);
    event.currentTarget.style.setProperty("--mouse-y", `${y * 100}%`);
    event.currentTarget.style.setProperty("--tilt-x", `${(y - .5) * -6}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${(x - .5) * 6}deg`);
  }
  return (
    <div ref={root} className={styles.page} data-motion={motion ? "on" : "off"}>
      <a href="#main" className={styles.skip}>Skip to content</a>
      <div ref={progress} className={styles.scrollProgress} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="The Code Squad InvoiceFlow home"><span className={styles.brandIcon} aria-hidden="true">{"</>"}</span><span><strong>THE CODE SQUAD</strong><small>INVOICEFLOW</small></span></Link>
        <nav aria-label="Main navigation"><a href="#experience">Experience</a><a href="#workflow">How it works</a><Link href="/workspace">Workspace</Link></nav>
        <Link href="/sign-up" className={styles.headerButton}>Create account <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroBackdrop} aria-hidden="true"><div /><div /></div>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> THE CODE SQUAD / INVOICEFLOW</p>
            <h1 id="hero-title">Your work.<br />Your identity.<br /><span>Beautifully billed.</span></h1>
            <p className={styles.intro}>Turn the work you do into an invoice that feels like you. Your logo. Your colours. Every detail in your control.</p>
            <div className={styles.actions}><Link href="/create" className={styles.primary}>Make your first invoice <span aria-hidden="true">↗</span></Link><a href="#experience" className={styles.textLink}>Explore the experience <span aria-hidden="true">↓</span></a></div>
            <p className={styles.helper}>Create your account, personalise your business, and open your private workspace. <Link href="/sign-in">Already a member? Sign in</Link></p>
          </div>
          <div className={styles.showcase} onPointerMove={hover} onPointerLeave={event => {event.currentTarget.style.setProperty("--tilt-x","0deg"); event.currentTarget.style.setProperty("--tilt-y","0deg");}}>
            <div className={styles.showcaseTop}><span><i />YOUR INVOICE. REIMAGINED.</span><span>LIVE PREVIEW</span></div>
            <div className={styles.documentWrap}>
              <article className={styles.document} style={{"--invoice-brand":colour} as CSSProperties} aria-label="Illustrative flexible invoice, A$1,480 total">
                <header className={styles.docBanner}><span aria-hidden="true">{"</>"}</span><strong>INVOICE</strong></header>
                <div className={styles.docBody}>
                  <div className={styles.docHeading}><div><h2>YOUR COMPANY</h2><p>Built around your identity</p></div><span>#001</span></div>
                  <div className={styles.docCustomer}><div><small>PREPARED FOR</small><strong>Your next client</strong></div><div><small>INVOICE STYLE</small><strong>Flexible sections</strong></div></div>
                  <div className={styles.docSections}><section><div><h3>Website design & build</h3><strong>A$1,200.00</strong></div><p>Design direction, responsive pages, and a polished launch experience.</p></section><section><div><h3>Launch support</h3><strong>A$280.00</strong></div><p>Final checks, handover, and support for your first week online.</p></section></div>
                  <div className={styles.docTotal}><span>Total due · AUD</span><strong>A$1,480.00</strong></div><p className={styles.docNote}>Space for your scope, your terms, and your way of working.</p>
                </div>
              </article>
            </div>
            <div className={styles.labControls}><div><span>Try your colour</span><small>Illustrative preview</small></div><div className={styles.swatches} role="group" aria-label="Example invoice colour">{colours.map(swatch => <button key={swatch.hex} type="button" onClick={() => setColour(swatch.hex)} aria-label={swatch.name} aria-pressed={colour===swatch.hex} style={{"--swatch":swatch.hex} as CSSProperties} />)}</div></div>
            <div className={styles.previewHint}><span>Move your mouse to explore</span><Link href="/sample">See the original TCS sample ↗</Link></div>
          </div>
        </section>
        <div className={styles.capabilities}><span>Your logo & colours</span><span>Flexible billing sections</span><span>Print to PDF</span></div>
        <section id="experience" className={styles.experience} aria-labelledby="experience-title">
          <div className={styles.sectionHeading} data-reveal><p className={styles.eyebrow}>THE EXPERIENCE</p><h2 id="experience-title">Less friction.<br /><span>More flow.</span></h2><p>A considered workspace for the details that matter.<br />A distinct identity for the work you put out.</p></div>
          <div className={styles.featureGrid}>{features.map(([number,label,title,description,href,action]) => <article className={styles.feature} key={number} data-reveal><div className={styles.featureTop}><span>{number}</span><span>{label}</span></div><h3>{title}</h3><p>{description}</p><Link href={href}>{action} <span aria-hidden="true">↗</span></Link></article>)}</div>
        </section>
        <section className={styles.workspaceSection} aria-labelledby="workspace-title" data-reveal>
          <div className={styles.workspaceCopy}><p className={styles.eyebrow}>YOUR CONTROL CENTRE</p><h2 id="workspace-title">One space.<br /><span>Every next move.</span></h2><p>Move between your dashboard, invoice drafts, creator, and brand studio. Configure reminder preferences for a future email workflow.</p><Link href="/workspace" className={styles.secondary}>Enter the workspace ↗</Link></div>
          <div className={styles.routeList}>{[["01","Dashboard","Your local drafts at a glance","/workspace"],["02","Invoice library","Find and reopen your draft invoices","/invoices"],["03","Brand studio","Your company, logo, and colour","/settings"],["04","Reminder studio","Configure preferences; email delivery comes later","/reminders"]].map(([number,title,description,href]) => <Link href={href} key={number}><span className={styles.routeNumber}>{number}</span><div><strong>{title}</strong><small>{description}</small></div><span aria-hidden="true">↗</span></Link>)}</div>
        </section>
        <section id="workflow" className={styles.workflow} aria-labelledby="workflow-title"><div className={styles.sectionHeading} data-reveal><p className={styles.eyebrow}>FROM DETAIL TO DOCUMENT</p><h2 id="workflow-title">Three steps. <span>Your signature.</span></h2></div><div className={styles.steps}>{[["01","Make it yours","Add your business details, upload a logo, and set your invoice colour."],["02","Build the details","Set your customer, dates, prices, and tax. Check the live preview as you edit."],["03","Take it with you","Save a draft on this device, or use your browser to print and save as PDF."]].map(([n,title,description]) => <div key={n} data-reveal><span>{n}</span><h3>{title}</h3><p>{description}</p></div>)}</div></section>
        <section className={styles.faq} aria-labelledby="faq-title" data-reveal><div><p className={styles.eyebrow}>BEFORE YOU BEGIN</p><h2 id="faq-title">Good questions.<br /><span>Clear answers.</span></h2></div><div><details><summary>Does my invoice have to use a table?</summary><p>No. New invoices open with a flexible billing body. Write sections for your scope, services, or milestones and assign amounts. The original TCS table remains available through its separate sample.</p></details><details><summary>Can my invoices use different branding from TCS?</summary><p>Yes. The platform is by The Code Squad, but your invoices use your company name, logo, and chosen accent colour.</p></details><details><summary>Where are my drafts stored?</summary><p>This review version stores drafts and branding in this browser on this device. There are no user accounts or cloud backups yet. Clear browser data and these drafts are removed.</p></details><details><summary>Can I send automated reminders?</summary><p>You can configure reminder preferences in the Reminder studio. Email scheduling and delivery are not connected in this version.</p></details><details><summary>How do I get a PDF?</summary><p>Choose Print / save as PDF in the creator, then Save as PDF in your browser. Turn off browser headers and footers. Direct PDF downloads will come in a later stage.</p></details></div></section>
        <section className={styles.closing} data-reveal><p className={styles.eyebrow}>YOUR NEXT INVOICE. REIMAGINED.</p><h2>Make it <span>yours.</span></h2><p>Built by The Code Squad. Personalised by you.</p><Link href="/create" className={styles.primary}>Launch the invoice creator ↗</Link></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.brand}><span className={styles.brandIcon} aria-hidden="true">{"</>"}</span><span><strong>THE CODE SQUAD</strong><small>INVOICEFLOW</small></span></Link><p>Designed for your business. Built by TCS.</p><button type="button" onClick={() => setMotion(!motion)} aria-pressed={motion}>{motion ? "Pause animations" : "Enable animations"}</button></footer>
    </div>
  );
}
