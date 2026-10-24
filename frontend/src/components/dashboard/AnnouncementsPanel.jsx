import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchFeed, postAnnouncement, deleteAnnouncement } from "../../store/slices/feedSlice";
import useCan from "../../hooks/useCan";
import { isUserActive } from "../../session/activity";

function timeAgo(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Small always-open announcements box (top-middle of the dashboard). Also keeps the feed
// (announcements + birthdays) fresh, which the birthday bar reads too.
export default function AnnouncementsPanel() {
  const dispatch = useDispatch();
  const can = useCan();
  const announcements = useSelector((state) => state.feed.announcements);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: "", message: "" });

  useEffect(() => {
    dispatch(fetchFeed());
    // Every 2 min, only while the user is active (an idle tab must not keep the session alive)
    const t = setInterval(() => { if (isUserActive(5 * 60000)) dispatch(fetchFeed()); }, 120000);
    return () => clearInterval(t);
  }, [dispatch]);

  async function handlePost(e) {
    e.preventDefault();
    const result = await dispatch(postAnnouncement(form));
    if (result.error) return; // toast shown by toastMiddleware
    setForm({ title: "", message: "" });
    setComposing(false);
    dispatch(fetchFeed());
  }

  return (
    <section className="bg-card border border-line rounded-xl p-4 w-full max-w-sm flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Megaphone size={15} /> Announcements</span>
        {can("announcements.manage") && !composing && (
          <button className="text-xs text-brass flex items-center gap-0.5" onClick={() => setComposing(true)}>
            <Plus size={13} /> Post
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-[150px] flex flex-col gap-2">
        {composing && (
          <form onSubmit={handlePost} className="bg-ivory rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">New announcement</span>
              <button type="button" onClick={() => setComposing(false)} aria-label="Cancel"><X size={14} /></button>
            </div>
            <input
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title" required maxLength={200}
              className="px-2 py-1.5 border border-line rounded-md text-sm"
            />
            <textarea
              value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Details (optional)" rows={3}
              className="px-2 py-1.5 border border-line rounded-md text-sm"
            />
            <button type="submit" className="btn-primary justify-center !py-1.5">Publish</button>
          </form>
        )}

        {announcements.length === 0 ? (
          <div className="text-xs text-slate text-center py-4">No announcements yet.</div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="border border-line rounded-lg px-3 py-2">
              <div className="flex justify-between gap-2">
                <div className="text-sm font-medium text-ink">{a.title}</div>
                {a.canDelete && (
                  <button onClick={() => dispatch(deleteAnnouncement(a.id))} className="text-slate hover:text-rust shrink-0" aria-label="Delete announcement">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {a.message && <div className="text-xs text-slate mt-0.5 whitespace-pre-line">{a.message}</div>}
              <div className="text-2xs text-slate mt-1">{a.created_by_name || "You"} · {timeAgo(a.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
