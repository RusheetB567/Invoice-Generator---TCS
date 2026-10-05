const sampleItems = [
  {
    period: "20 Apr - 24 Apr",
    details:
      "IT Support & User Assistance\nMicrosoft 365 Administration Support\nTechnical Troubleshooting & Remote Technical Assistance",
    hours: "7.5",
    rate: "A$27.00",
    amount: "A$202.50",
  },
  {
    period: "27 Apr - 1 May",
    details: "No IT Related Issues Reported",
    hours: "0.0",
    rate: "A$27.00",
    amount: "A$0.00",
  },
  {
    period: "4 May - 8 May",
    details: "General IT Support & Remote User Assistance",
    hours: "2.0",
    rate: "A$27.00",
    amount: "A$54.00",
  },
  {
    period: "11 May - 15 May",
    details: "IT Support & System Assistance",
    hours: "1.5",
    rate: "A$27.00",
    amount: "A$40.50",
  },
  {
    period: "18 May - 22 May",
    details:
      "User Support, Troubleshooting & Microsoft 365 Administration Support",
    hours: "6.0",
    rate: "A$27.00",
    amount: "A$162.00",
  },
  {
    period: "25 May - 29 May",
    details: "General IT Support & Assistance",
    hours: "1.0",
    rate: "A$27.00",
    amount: "A$27.00",
  },
];

export default function Home() {
  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <a className="product-name" href="/">
            InvoiceFlow
          </a>
          <p>Invoices that feel like your business.</p>
        </div>
        <span className="preview-badge">Template preview</span>
      </header>

      <section className="preview-intro" aria-labelledby="preview-title">
        <div>
          <h1 id="preview-title">Your first invoice template</h1>
          <p>
            The Code Squad design, with weekly services and clear payment
            details.
          </p>
        </div>
        <span className="sample-label">Sample invoice · AUD</span>
      </section>

      <article className="invoice" aria-label="Sample Code Squad invoice">
        <div className="invoice-banner" aria-hidden="true">
          <div className="banner-circle circle-left" />
          <div className="banner-circle circle-right" />
          <div className="code-logo">{"</>"}</div>
        </div>

        <div className="invoice-content">
          <header className="invoice-heading">
            <div>
              <h2>THE CODE SQUAD</h2>
              <p className="business-subtitle">IT Support Services</p>
            </div>

            <dl className="invoice-meta">
              <div>
                <dt>Invoice #</dt>
                <dd>005</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>3 June 2026</dd>
              </div>
              <div>
                <dt>Due Date</dt>
                <dd>10 June 2026</dd>
              </div>
            </dl>
          </header>

          <section className="customer-grid" aria-label="Customer details">
            <div>
              <h3>BILL TO</h3>
              <p>Education Embassy</p>
            </div>
            <div>
              <h3>SERVICE LOCATION</h3>
              <p>2/250 Orange Grove Rd, Salisbury</p>
            </div>
          </section>

          <section className="services" aria-labelledby="services-title">
            <h3 id="services-title">Services Provided</h3>

            <div
              className="table-scroll"
              role="region"
              aria-label="Weekly services, scroll horizontally on small screens"
              tabIndex={0}
            >
              <table className="services-table">
                <caption className="sr-only">
                  Six weeks of IT services, totalling 18 billable hours
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Details</th>
                    <th scope="col" className="numeric">Hours</th>
                    <th scope="col" className="numeric">Rate</th>
                    <th scope="col" className="numeric">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleItems.map((item) => (
                    <tr key={item.period}>
                      <th scope="row">Week: {item.period}</th>
                      <td className="service-details">{item.details}</td>
                      <td className="numeric">{item.hours}</td>
                      <td className="numeric">{item.rate}</td>
                      <td className="numeric">{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="invoice-summary">
            <section className="notes" aria-labelledby="notes-title">
              <h3 id="notes-title">Notes</h3>
              <p>
                Thank you for your business. Please make payment by the due
                date.
              </p>
            </section>

            <dl className="totals">
              <div>
                <dt>Subtotal</dt>
                <dd>A$486.00</dd>
              </div>
              <div>
                <dt>Tax (0%)</dt>
                <dd>A$0.00</dd>
              </div>
              <div className="total-due">
                <dt>Total Due</dt>
                <dd>A$486.00</dd>
              </div>
            </dl>
          </div>

          <section className="payment" aria-labelledby="payment-title">
            <h3 id="payment-title">Payment Details</h3>
            <dl>
              <div>
                <dt>Account Name</dt>
                <dd>BHATTA RUSHEET</dd>
              </div>
              <div>
                <dt>BSB</dt>
                <dd>To be added in company settings</dd>
              </div>
              <div>
                <dt>Account Number</dt>
                <dd>To be added in company settings</dd>
              </div>
              <div>
                <dt>Business Identifier</dt>
                <dd>To be confirmed</dd>
              </div>
            </dl>
          </section>

          <footer className="invoice-footer">
            <span>THE CODE SQUAD · IT Support Services</span>
            <span>Page 1</span>
          </footer>
        </div>
      </article>
    </main>
  );
}