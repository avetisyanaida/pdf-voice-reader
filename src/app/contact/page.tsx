export default function ContactPage() {
    return (
        <main className="legalPage">
            <section className="legalCard">
                <p className="eyebrow">PDF Voice Reader</p>

                <h1>Contact</h1>

                <p>
                    For support, billing questions, refunds, account deletion,
                    or product questions, contact us by email.
                </p>

                <div className="contactBox">
                    <span>Email</span>

                    <a href="mailto:pdfreadervoice@gmail.com">
                        pdfreadervoice@gmail.com
                    </a>
                </div>

                <h2>Support details</h2>

                <p>
                    Please include your account email and a short description of
                    the issue. For payment questions, include the Paddle order
                    email or receipt information if available.
                </p>

                <h2>Product</h2>

                <p>
                    PDF Voice Reader is a web app for uploading PDF files,
                    extracting readable text, listening to the text with browser
                    voice playback, and saving reading progress in the cloud.
                </p>
            </section>
        </main>
    );
}