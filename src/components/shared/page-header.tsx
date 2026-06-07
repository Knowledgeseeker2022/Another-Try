import { Header } from "@/components/layout/header";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <>
      <Header title={title} subtitle={subtitle} />
      {(actions || children) && (
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap bg-background/50">
          <div className="flex-1 min-w-0">{children}</div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
    </>
  );
}
