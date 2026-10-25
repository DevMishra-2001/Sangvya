import { MyAttendanceTabs } from "@/components/my-attendance/my-attendance-tabs";

export default function MyAttendanceLayout({ children }: LayoutProps<"/my-attendance">) {
  return (
    <div>
      <MyAttendanceTabs />
      {children}
    </div>
  );
}
