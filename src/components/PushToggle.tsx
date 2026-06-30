import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  disablePushNotifications,
  enablePushNotifications,
  isCurrentlySubscribed,
  isPushSupported,
} from "@/lib/push";

export function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    isCurrentlySubscribed().then(setSubscribed);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const res = await enablePushNotifications();
    setLoading(false);
    if (res.ok) {
      setSubscribed(true);
      setPermission(Notification.permission);
      toast.success("¡Notificaciones activadas! 🔔");
    } else {
      toast.error(res.reason || "No se pudieron activar.");
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    await disablePushNotifications();
    setLoading(false);
    setSubscribed(false);
    toast.success("Notificaciones desactivadas en este dispositivo.");
  };

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Tu navegador no soporta notificaciones push. Prueba con Chrome (Android) o
          añade la app a pantalla de inicio en iPhone (iOS 16.4+).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2">
          {subscribed ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Notificaciones en este móvil</p>
          <p className="text-sm text-muted-foreground">
            {subscribed
              ? "Recibirás avisos aunque tengas la app cerrada."
              : "Activa para que te avise cuando tu osit@ te escriba, deje notas, cambie de ánimo o añada fechas."}
          </p>
        </div>
      </div>

      {permission === "denied" && (
        <p className="text-sm text-destructive">
          Has bloqueado las notificaciones en este navegador. Actívalas desde los ajustes del navegador y vuelve aquí.
        </p>
      )}

      {isIOS && !isStandalone && (
        <p className="rounded-xl bg-accent/30 p-3 text-xs text-foreground">
          📱 En iPhone, primero pulsa <strong>Compartir → Añadir a pantalla de inicio</strong>. Luego abre la app desde el
          icono y vuelve aquí para activar las notificaciones (requiere iOS 16.4 o superior).
        </p>
      )}

      <Button
        onClick={subscribed ? handleDisable : handleEnable}
        disabled={loading || permission === "denied"}
        variant={subscribed ? "outline" : "default"}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : subscribed ? (
          "Desactivar en este dispositivo"
        ) : (
          "Activar notificaciones"
        )}
      </Button>
    </div>
  );
}
