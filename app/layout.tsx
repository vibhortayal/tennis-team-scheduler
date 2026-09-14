import Script from 'next/script';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="6d4c020c-affc-474c-aed2-271abfde1035"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
