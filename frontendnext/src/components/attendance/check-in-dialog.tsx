"use client";

// Check in / check out: asks for location, opens the camera for a selfie, picks
// the work mode, then punches at the current time (the server sets the time).
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, LocateFixed, LogIn, LogOut, MapPinOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { LOCATION_OPTIONS } from "@/lib/constants";
import { uploadService } from "@/lib/services/upload";
import type { PunchGeo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useSelfStore } from "@/stores/self-store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Action = "punch-in" | "punch-out";

type GeoState = { status: "locating" } | { status: "ok"; geo: PunchGeo } | { status: "error"; message: string };
type CameraState = { status: "starting" } | { status: "live" } | { status: "captured"; preview: string } | { status: "error"; message: string };
// The selfie is uploaded as soon as it's taken; check-in only sends its URL.
// A failed upload never blocks check-in — it's just saved without a photo.
type PhotoUpload = { status: "none" } | { status: "uploading" } | { status: "done"; url: string } | { status: "failed"; message: string };

function geoError(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) return "Location is blocked. Allow it from the address bar's site settings, then retry.";
  if (err.code === err.TIMEOUT) return "Couldn't get your location in time.";
  return "Your location isn't available right now.";
}

function cameraError(err: unknown) {
  const name = (err as DOMException)?.name;
  if (name === "NotAllowedError") return "Camera is blocked. Allow it from the address bar's site settings, then retry.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app.";
  return "The camera couldn't be opened.";
}

export function CheckInDialog({ open, onOpenChange, action, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; action: Action; onDone?: () => void }) {
  const company = useAuthStore((s) => s.company);
  const punch = useSelfStore((s) => s.punch);
  const checkIn = action === "punch-in";

  const [geo, setGeo] = useState<GeoState>({ status: "locating" });
  const [camera, setCamera] = useState<CameraState>({ status: "starting" });
  const [mode, setMode] = useState("office");
  const [remarks, setRemarks] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [photo, setPhoto] = useState<PhotoUpload>({ status: "none" });
  const [saving, setSaving] = useState(false);
  // Ignores an upload that finishes after the photo was retaken / the dialog closed
  const shot = useRef(0);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const locate = useCallback(() => {
    setGeo({ status: "locating" });
    if (!("geolocation" in navigator)) return setGeo({ status: "error", message: "This browser can't share your location." });
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ status: "ok", geo: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) } }),
      (err) => setGeo({ status: "error", message: geoError(err) }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    shot.current++;
    setPhoto({ status: "none" });
    setCamera({ status: "starting" });
    if (!navigator.mediaDevices?.getUserMedia) return setCamera({ status: "error", message: "This browser can't open the camera (it needs HTTPS)." });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setCamera({ status: "live" });
    } catch (err) {
      setCamera({ status: "error", message: cameraError(err) });
    }
  }, [stopCamera]);

  // Ask for location + camera each time the dialog opens; release the camera when it closes
  useEffect(() => {
    if (!open) return;
    const start = setTimeout(() => {
      locate();
      startCamera();
    }, 0);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(start);
      clearInterval(tick);
      stopCamera();
    };
  }, [open, locate, startCamera, stopCamera]);

  // Free the preview image's memory when it's replaced
  const preview = camera.status === "captured" ? camera.preview : null;
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function uploadPhoto(blob: Blob) {
    const id = ++shot.current;
    setPhoto({ status: "uploading" });
    try {
      const { url } = await uploadService.image(blob, "attendance-photo", "selfie.jpg");
      if (id === shot.current) setPhoto({ status: "done", url });
    } catch (err) {
      if (id === shot.current) setPhoto({ status: "failed", message: errorMessage(err, "Couldn't upload the photo") });
    }
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Mirror like the live preview, crop to a centred square
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) return toast.error("Couldn't take the photo, try again");
        stopCamera();
        setCamera({ status: "captured", preview: URL.createObjectURL(blob) });
        uploadPhoto(blob);
      },
      "image/jpeg",
      0.85,
    );
  }

  // Take a photo when the camera works (no camera → skip it); wait for the photo
  // upload and the location lookup so they're included
  const cameraUsable = camera.status !== "error";
  const uploading = photo.status === "uploading";
  const canSubmit = !saving && !uploading && (camera.status === "captured" || !cameraUsable) && geo.status !== "locating";

  async function submit() {
    setSaving(true);
    const photoUrl = photo.status === "done" ? photo.url : undefined;
    const position = geo.status === "ok" ? geo.geo : null;
    const ok = await punch(action, {
      location: mode,
      remarks: remarks.trim() || undefined,
      latitude: position?.lat,
      longitude: position?.lng,
      accuracy: position?.accuracy ?? undefined,
      photoUrl,
    });
    setSaving(false);
    if (ok) {
      setRemarks("");
      onOpenChange(false);
      onDone?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{checkIn ? "Check in" : "Check out"}</DialogTitle>
          <DialogDescription>
            {company?.name} ·{" "}
            <span className="font-medium text-foreground tabular-nums">
              {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })},{" "}
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Camera */}
        <div className="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-2xl border bg-muted">
          <video
            ref={video}
            playsInline
            muted
            aria-label="Camera preview"
            className={cn("size-full -scale-x-100 object-cover", camera.status !== "live" && "hidden")}
          />
          {camera.status === "captured" && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview blob
            <img src={camera.preview} alt="Your photo" className="size-full object-cover" />
          )}
          {camera.status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Opening camera…
            </div>
          )}
          {camera.status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
              <CameraOff className="size-8" />
              {camera.message}
              <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                <RefreshCw /> Retry camera
              </Button>
            </div>
          )}
        </div>
        {camera.status === "captured" && photo.status !== "none" && (
          <p
            role="status"
            className={cn(
              "flex items-center justify-center gap-2 text-center text-xs",
              photo.status === "failed" ? "text-warning" : photo.status === "done" ? "text-primary" : "text-muted-foreground",
            )}
          >
            {photo.status === "uploading" && (
              <>
                <Spinner /> Uploading photo…
              </>
            )}
            {photo.status === "done" && "Photo saved"}
            {photo.status === "failed" && `${photo.message} — you can still ${checkIn ? "check in" : "check out"}; it'll be saved without a photo.`}
          </p>
        )}
        <div className="flex justify-center">
          {camera.status === "live" && (
            <Button type="button" onClick={capture}>
              <Camera /> Take photo
            </Button>
          )}
          {camera.status === "captured" && (
            <Button type="button" variant="outline" onClick={startCamera} disabled={saving}>
              <RefreshCw /> Retake
            </Button>
          )}
        </div>

        {/* Location */}
        <div className={cn("flex items-center gap-3 rounded-lg border px-3 py-2 text-sm", geo.status === "error" && "border-warning/50 bg-warning/10")}>
          {geo.status === "locating" && (
            <>
              <Spinner /> <span className="text-muted-foreground">Getting your location…</span>
            </>
          )}
          {geo.status === "ok" && (
            <>
              <LocateFixed className="size-4 shrink-0 text-primary" />
              <span className="flex-1">
                Location captured <span className="text-muted-foreground">· within {geo.geo.accuracy} m</span>
              </span>
            </>
          )}
          {geo.status === "error" && (
            <>
              <MapPinOff className="size-4 shrink-0 text-warning" />
              <span className="flex-1">{geo.message}</span>
              <Button type="button" variant="outline" size="sm" onClick={locate}>
                Retry
              </Button>
            </>
          )}
        </div>

        {/* Work mode */}
        <div className="flex flex-col gap-2">
          <Label id="work-mode-label">Work mode</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={mode}
            onValueChange={(v) => v && setMode(v)}
            aria-labelledby="work-mode-label"
            className="grid w-full grid-cols-2 sm:grid-cols-3"
          >
            {LOCATION_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className="h-9 w-full data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="punch-remarks">Remarks</Label>
          <Textarea
            id="punch-remarks"
            rows={2}
            maxLength={300}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={mode === "client_site" ? "Client name / site" : "Optional"}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant={checkIn ? "default" : "destructive"} onClick={submit} disabled={!canSubmit}>
            {saving ? <Spinner /> : checkIn ? <LogIn /> : <LogOut />}
            {saving
              ? "Saving…"
              : uploading
                ? "Uploading photo…"
                : camera.status === "live"
                  ? "Take a photo first"
                  : checkIn
                    ? "Check in now"
                    : "Check out now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Opens the dialog for whichever punch comes next (check out while working, else check in)
export function CheckInButton({ className, size = "lg", onDone }: { className?: string; size?: "default" | "lg"; onDone?: () => void }) {
  const today = useSelfStore((s) => s.today);
  const busy = useSelfStore((s) => s.busy);
  const [open, setOpen] = useState(false);
  if (!today) return null;
  const working = Boolean(today.day?.punchIn) && !today.day?.punchOut;
  const action: Action = working ? "punch-out" : "punch-in";
  return (
    <>
      <Button
        size={size}
        variant={working ? "destructive" : "default"}
        disabled={busy}
        onClick={() => setOpen(true)}
        className={className}
        aria-label={working ? "Check out" : "Check in"}
      >
        {working ? <LogOut /> : <LogIn />}
        <span className="hidden sm:inline">{working ? "Check out" : "Check in"}</span>
      </Button>
      <CheckInDialog open={open} onOpenChange={setOpen} action={action} onDone={onDone} />
    </>
  );
}
