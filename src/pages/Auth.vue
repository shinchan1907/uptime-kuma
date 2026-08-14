<template>
    <div class="auth-wrap">
        <!-- Brand panel -->
        <aside class="brand-panel">
            <div class="brand-inner">
                <router-link to="/" class="brand-logo">
                    <object width="46" height="46" data="/icon.svg" tabindex="-1" aria-label="PulseGuard" />
                    <span>Pulse<b>Guard</b></span>
                </router-link>

                <div class="brand-copy">
                    <p class="eyebrow">Monitor · Detect · Protect</p>
                    <h1>Uptime monitoring that never blinks.</h1>
                    <p class="lead">
                        Watch your websites, APIs and servers around the clock — and get pinged
                        the second something breaks.
                    </p>
                    <ul class="brand-bullets">
                        <li><span class="tick" />Unlimited monitors, free forever</li>
                        <li><span class="tick" />Passwordless — just your email</li>
                        <li><span class="tick" />Your data isolated from everyone else</li>
                    </ul>
                </div>

                <p class="brand-foot">© {{ year }} PulseGuard · pg.bytenex.io</p>
            </div>
        </aside>

        <!-- Form panel -->
        <main class="form-panel">
            <div class="form-card">
                <router-link to="/" class="mobile-logo">
                    <object width="38" height="38" data="/icon.svg" tabindex="-1" aria-label="PulseGuard" />
                </router-link>

                <!-- STEP 1: email -->
                <form v-if="step === 'email'" @submit.prevent="requestCode">
                    <h2>{{ isSignup ? "Create your account" : "Welcome back" }}</h2>
                    <p class="sub">
                        {{ isSignup
                            ? "Enter your email and we'll send you a code to get started."
                            : "Enter your email and we'll send you a sign-in code." }}
                    </p>

                    <div class="field">
                        <label for="email">Email address</label>
                        <input
                            id="email"
                            ref="emailInput"
                            v-model="email"
                            type="email"
                            autocomplete="email"
                            placeholder="you@company.com"
                            required
                        />
                    </div>

                    <button class="submit" type="submit" :disabled="processing">
                        <span v-if="processing" class="spinner" />
                        {{ processing ? "Sending…" : "Send code" }}
                    </button>

                    <p v-if="error" class="err" role="alert">{{ error }}</p>

                    <p class="switch">
                        <template v-if="isSignup">
                            Already have an account?
                            <router-link to="/signin">Sign in</router-link>
                        </template>
                        <template v-else>
                            New to PulseGuard?
                            <router-link to="/signup">Create an account</router-link>
                        </template>
                    </p>
                </form>

                <!-- STEP 2: code -->
                <form v-else @submit.prevent="verifyCode">
                    <button type="button" class="back" @click="backToEmail">
                        ← Change email
                    </button>
                    <h2>Enter your code</h2>
                    <p class="sub">
                        We sent a 6-digit code to <strong>{{ email }}</strong>.
                        It expires in {{ expiresMinutes }} minutes.
                    </p>

                    <div class="field">
                        <label for="code">Verification code</label>
                        <input
                            id="code"
                            ref="codeInput"
                            v-model="code"
                            type="text"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            maxlength="6"
                            placeholder="123456"
                            class="code-input"
                            required
                        />
                    </div>

                    <button class="submit" type="submit" :disabled="processing">
                        <span v-if="processing" class="spinner" />
                        {{ processing ? "Verifying…" : (isSignup ? "Create account" : "Sign in") }}
                    </button>

                    <p v-if="error" class="err" role="alert">{{ error }}</p>

                    <p class="switch">
                        Didn't get it?
                        <button type="button" class="linkbtn" :disabled="resendCooldown > 0" @click="requestCode">
                            {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code" }}
                        </button>
                    </p>
                </form>
            </div>
        </main>
    </div>
</template>

<script>
export default {
    data() {
        return {
            step: "email",
            email: "",
            code: "",
            processing: false,
            error: "",
            expiresMinutes: 10,
            resendCooldown: 0,
            resendTimer: null,
            year: new Date().getFullYear(),
        };
    },
    computed: {
        /**
         * Whether this page is in sign-up mode (vs sign-in).
         * @returns {boolean} True in sign-up mode.
         */
        isSignup() {
            return this.$route.meta?.mode === "signup";
        },
    },
    watch: {
        // Reset the flow when navigating between /signin and /signup.
        "$route.path"() {
            this.step = "email";
            this.code = "";
            this.error = "";
        },
    },
    mounted() {
        // If already logged in, skip straight to the dashboard.
        if (this.$root.loggedIn) {
            this.$router.push("/dashboard");
            return;
        }
        this.$nextTick(() => this.$refs.emailInput?.focus());
    },
    beforeUnmount() {
        clearInterval(this.resendTimer);
    },
    methods: {
        /**
         * Request an OTP for the entered email (register or login flow).
         * @returns {void}
         */
        requestCode() {
            if (!this.email) {
                return;
            }
            this.processing = true;
            this.error = "";

            const fn = this.isSignup ? this.$root.registerRequestOTP : this.$root.loginRequestOTP;
            fn(this.email, (res) => {
                this.processing = false;
                if (res.ok) {
                    this.expiresMinutes = res.expiresMinutes || 10;
                    this.step = "code";
                    this.startResendCooldown();
                    this.$nextTick(() => this.$refs.codeInput?.focus());
                } else {
                    this.error = res.msg || "Something went wrong. Please try again.";
                }
            });
        },

        /**
         * Verify the entered code and complete auth.
         * @returns {void}
         */
        verifyCode() {
            if (!this.code) {
                return;
            }
            this.processing = true;
            this.error = "";

            const fn = this.isSignup ? this.$root.registerVerifyOTP : this.$root.loginVerifyOTP;
            fn(this.email, this.code.trim(), (res) => {
                this.processing = false;
                if (res.ok) {
                    this.$router.push("/dashboard");
                } else {
                    this.error = res.msg || "Invalid or expired code.";
                    this.code = "";
                    this.$nextTick(() => this.$refs.codeInput?.focus());
                }
            });
        },

        /**
         * Return to the email step.
         * @returns {void}
         */
        backToEmail() {
            this.step = "email";
            this.code = "";
            this.error = "";
            this.$nextTick(() => this.$refs.emailInput?.focus());
        },

        /**
         * Start the resend cooldown countdown (matches server-side cooldown).
         * @returns {void}
         */
        startResendCooldown() {
            this.resendCooldown = 60;
            clearInterval(this.resendTimer);
            this.resendTimer = setInterval(() => {
                this.resendCooldown -= 1;
                if (this.resendCooldown <= 0) {
                    clearInterval(this.resendTimer);
                }
            }, 1000);
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.auth-wrap {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    min-height: 100vh;
}

/* Brand panel */
.brand-panel {
    position: relative;
    background:
        radial-gradient(70% 60% at 20% 15%, rgba(63, 217, 138, 0.16), transparent 60%),
        linear-gradient(160deg, #0f2130 0%, #0a141f 100%);
    color: #e8f0ec;
    overflow: hidden;
}
.brand-panel::after {
    content: "";
    position: absolute;
    inset: auto -10% -20% -10%;
    height: 40%;
    background: radial-gradient(60% 100% at 50% 100%, rgba(36, 211, 189, 0.14), transparent 70%);
}
.brand-inner {
    position: relative;
    z-index: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 44px 52px;
}
.brand-logo {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #fff;
    text-decoration: none;
    b { font-weight: 800; color: $highlight; }
    object { pointer-events: none; }
}
.brand-copy {
    margin-top: auto;
    margin-bottom: auto;
    max-width: 30ch;
}
.eyebrow {
    font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: $highlight;
    margin-bottom: 18px;
}
.brand-copy h1 {
    font-size: clamp(1.9rem, 1.4rem + 1.6vw, 2.7rem);
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0 0 16px;
}
.brand-copy .lead {
    color: #a7bcb6;
    font-size: 1.05rem;
    line-height: 1.6;
    margin: 0 0 28px;
}
.brand-bullets {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 13px;
    li {
        display: flex;
        align-items: center;
        gap: 11px;
        font-size: 0.98rem;
        color: #d5e3de;
    }
    .tick {
        flex: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(63, 217, 138, 0.16);
        position: relative;
    }
    .tick::after {
        content: "";
        position: absolute;
        left: 6px;
        top: 4px;
        width: 5px;
        height: 9px;
        border: solid $highlight;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }
}
.brand-foot {
    font-size: 13px;
    color: #6a8078;
    margin: 0;
}

/* Form panel */
.form-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    background: var(--bs-body-bg, #fff);
}
.form-card {
    width: 100%;
    max-width: 380px;
}
.mobile-logo {
    display: none;
    margin-bottom: 24px;
    object { pointer-events: none; }
}
h2 {
    font-size: 1.7rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0 0 8px;
}
.sub {
    color: $secondary-text;
    font-size: 0.98rem;
    margin: 0 0 26px;
    line-height: 1.55;
}
.field {
    text-align: left;
    margin-bottom: 18px;
    label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 7px;
    }
    input {
        width: 100%;
        padding: 13px 15px;
        font-size: 15px;
        border: 1px solid rgba(120, 140, 150, 0.35);
        border-radius: 11px;
        background: transparent;
        color: inherit;
        transition: border-color 0.15s, box-shadow 0.15s;
        &:focus {
            outline: none;
            border-color: $primary;
            box-shadow: 0 0 0 3px rgba(18, 185, 129, 0.16);
        }
    }
    .code-input {
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        font-size: 26px;
        letter-spacing: 12px;
        text-align: center;
        font-weight: 600;
    }
}
.submit {
    width: 100%;
    padding: 13px;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    border: none;
    border-radius: 11px;
    cursor: pointer;
    background: linear-gradient(115deg, $primary 0%, #0a9e8c 100%);
    box-shadow: 0 10px 24px -10px rgba(18, 185, 129, 0.6);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 16px 30px -12px rgba(18, 185, 129, 0.7); }
    &:disabled { opacity: 0.7; cursor: default; }
}
.spinner {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.err {
    margin: 16px 0 0;
    padding: 11px 14px;
    background: rgba(239, 68, 68, 0.1);
    color: $danger;
    border-radius: 10px;
    font-size: 0.9rem;
    text-align: left;
}
.switch {
    margin: 22px 0 0;
    font-size: 0.94rem;
    color: $secondary-text;
    a, .linkbtn {
        color: $primary;
        font-weight: 600;
        text-decoration: none;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        &:hover { text-decoration: underline; }
        &:disabled { color: $secondary-text; cursor: default; text-decoration: none; }
    }
}
.back {
    background: none;
    border: none;
    color: $secondary-text;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 18px;
    &:hover { color: $primary; }
}

@media (max-width: 860px) {
    .auth-wrap { grid-template-columns: 1fr; }
    .brand-panel { display: none; }
    .mobile-logo { display: block; }
}
</style>
