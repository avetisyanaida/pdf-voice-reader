export default function PrivacyPage() {
    return (
        <main className="legalPage">
            <section className="legalCard">
                <p className="eyebrow">PDF Voice Reader</p>

                <h1>Privacy Policy</h1>

                <p className="legalDate">Last updated: June 21, 2026</p>

                <h2>1. Information we collect</h2>
                <p>
                    When you create an account, we collect your email address.
                    When you upload a PDF, we may store the extracted text, file
                    name, selected language, selected voice, reading speed, and
                    reading position so that you can continue reading later.
                </p>

                <h2>2. How we use your information</h2>
                <p>
                    We use your information to provide the PDF reader, save your
                    reading history, manage your account, and control Free or Pro
                    access.
                </p>

                <h2>3. Payments</h2>
                <p>
                    Payments are processed by Paddle. We do not store your card
                    number, CVC, or full payment details. Paddle handles payment
                    processing, invoices, taxes, and subscription billing.
                </p>

                <h2>4. PDF files and extracted text</h2>
                <p>
                    PDF text extraction happens in your browser. If you are
                    logged in, the extracted text may be saved to your account so
                    you can access it later. You can choose not to use cloud
                    saving by not logging in.
                </p>

                <h2>5. Third-party services</h2>
                <p>
                    We use Supabase for authentication and cloud data storage,
                    Vercel for hosting, and Paddle for payments.
                </p>

                <h2>6. Data deletion</h2>
                <p>
                    You can request account or document deletion by contacting
                    support at{" "}
                    <a href="mailto:pdfreadervoice@gmail.com">
                        pdfreadervoice@gmail.com
                    </a>
                    .
                </p>

                <h2>7. Security</h2>
                <p>
                    We use reasonable technical measures to protect your data.
                    However, no online service can guarantee complete security.
                </p>

                <h2>8. Contact</h2>
                <p>
                    For privacy questions, contact{" "}
                    <a href="mailto:pdfreadervoice@gmail.com">
                        pdfreadervoice@gmail.com
                    </a>
                    .
                </p>
            </section>
        </main>
    );
}