import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "article-caster",
  description: "Personal podcast feeder for articles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {process.env.NODE_ENV === 'development' && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '150px',
            height: '150px',
            overflow: 'hidden',
            zIndex: 9999,
            pointerEvents: 'none'
          }}>
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '250px',
              backgroundColor: '#ef4444',
              color: 'white',
              padding: '10px 0',
              transform: 'translate(-50%, -50%) rotate(-45deg) translateY(45px)',
              fontWeight: 'bold',
              letterSpacing: '2px',
              fontSize: '16px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              DEV
            </div>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
