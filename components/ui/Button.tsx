export default function Button({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-black text-white py-3 rounded-xl font-medium active:opacity-80 transition"
    >
      {children}
    </button>
  );
}
