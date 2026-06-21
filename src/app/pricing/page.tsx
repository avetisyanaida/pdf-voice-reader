export default function PricingPage() {
    return (
        <main className="legalPage">
            <section className="legalCard pricingCard">
                <p className="eyebrow">PDF Voice Reader</p>

                <h1>Pricing</h1>

                <p className="legalDate">Simple plans for PDF listening and reading progress.</p>

                <div className="pricingGrid">
                    <div className="pricingPlan">
                        <div>
                            <h2>Free</h2>
                            <p className="priceText">$0</p>
                            <p>For trying PDF Voice Reader.</p>
                        </div>

                        <ul>
                            <li>1 saved PDF</li>
                            <li>Basic PDF text extraction</li>
                            <li>Browser voice playback</li>
                            <li>Basic reading controls</li>
                        </ul>
                    </div>

                    <div className="pricingPlan proPricingPlan">
                        <div>
                            <h2>Pro</h2>
                            <p className="priceText">$4.99/month</p>
                            <p>For saving more PDFs and keeping reading history.</p>
                        </div>

                        <ul>
                            <li>Unlimited saved PDFs</li>
                            <li>Cloud reading history</li>
                            <li>Continue reading from saved progress</li>
                            <li>English and Russian voice reading</li>
                            <li>Cancel anytime</li>
                        </ul>

                        <a className="pricingButton" href="/">
                            Upgrade in app
                        </a>
                    </div>
                </div>

                <h2>Payment processing</h2>

                <p>
                    Payments and subscriptions are securely processed by Paddle.
                    PDF Voice Reader does not store card details.
                </p>

                <h2>Refunds</h2>

                <p>
                    Refund requests are handled according to our{" "}
                    <a href="/refund">Refund Policy</a>.
                </p>

                <h2>Questions</h2>

                <p>
                    Contact us at{" "}
                    <a href="mailto:pdfreadervoice@gmail.com">
                        pdfreadervoice@gmail.com
                    </a>
                    .
                </p>
            </section>
        </main>
    );
}