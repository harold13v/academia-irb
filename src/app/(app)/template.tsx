/** Cada navegación dentro del shell entra con un leve ascenso (el shell no se remonta: solo el contenido). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
