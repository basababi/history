export const metadata = {
  title: 'Эртний Өв — Admin',
  description: 'Nomad Legacy контентийн засаглалын самбар',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
