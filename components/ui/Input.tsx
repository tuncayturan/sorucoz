export default function Input(props: any) {
  return (
    <input
      {...props}
      className="w-full bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-black/20"
    />
  );
}
