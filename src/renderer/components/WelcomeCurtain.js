// src/renderer/components/WelcomeCurtain.js
import "./WelcomeCurtain.css";

export class WelcomeCurtain {
  constructor(options = {}) {
    this.enabled = options.enabled ?? true; // 🔹 Fácil de activar/desactivar
    this.autoDismiss = options.autoDismiss ?? false;
    this.dismissDelay = options.dismissDelay ?? 5000; // 5 segundos si es auto
    this.onDismiss = options.onDismiss || null;
    this.element = null;
  }

  show() {
    if (!this.enabled) return;

    // Crear elemento HTML
    this.element = document.createElement("div");
    this.element.className = "welcome-curtain";
    this.element.innerHTML = `
      <div class="curtain-backdrop"></div>
      <div class="curtain-content">
        <div class="curtain-card">
          <div class="curtain-header">
            <i class="fa-solid fa-flask"></i>
            <h2>Gracias por participar en la etapa de pruebas de Ges-Tao</h2>
          </div>
          
          <div class="curtain-body">
            <p>
              Actualmente, el sistema se encuentra en desarrollo,
               por lo que algunas funciones podrían no estar disponibles
                o presentar errores visuales y técnicos durante su uso.
            </p>
            <p class="highlight">
              Una vez terminada la prueba puedes probar el software con libertad 
              y dar tus observaciones.
            </p>
          </div>

          <div class="curtain-footer">
            <button class="btn-curtain-continue" id="btn-curtain-continue">
              <span>Continuar</span>
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);

    // Vincular evento de cierre
    const btnContinue = this.element.querySelector("#btn-curtain-continue");
    if (btnContinue) {
      btnContinue.addEventListener("click", () => this.dismiss());
    }

    // Auto-dismiss si está configurado
    if (this.autoDismiss) {
      setTimeout(() => this.dismiss(), this.dismissDelay);
    }

    // Animación de entrada
    requestAnimationFrame(() => {
      this.element.classList.add("visible");
    });
  }

  dismiss() {
    if (!this.element) return;

    // Animación de salida
    this.element.classList.remove("visible");

    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.remove();
      }
      this.element = null;

      if (this.onDismiss) {
        this.onDismiss();
      }
    }, 300); // Duración de la animación CSS
  }

  destroy() {
    this.dismiss();
  }
}
