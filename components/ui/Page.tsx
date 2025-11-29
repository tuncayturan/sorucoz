"use client";

export default function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-12 pb-20 px-5">
      <h1 className="text-3xl font-semibold mb-6">{title}</h1>
      {children}
    </div>
  );
}
