<template>
    <div tabindex="-1" class="dropdown" @focusin="openMenu" @focusout="handleFocusOut">
        <button type="button" class="filter-dropdown-status" :class="{ active: filterActive }" tabindex="0">
            <div class="px-1 d-flex align-items-center">
                <slot name="status"></slot>
            </div>
            <span class="px-1">
                <font-awesome-icon icon="angle-down" />
            </span>
        </button>
        <ul class="filter-dropdown-menu" :class="{ open: open }">
            <slot name="dropdown"></slot>
        </ul>
    </div>
</template>

<script>
export default {
    components: {},
    props: {
        filterActive: {
            type: Boolean,
            required: true,
        },
    },
    emits: ["openMenu"],
    data() {
        return {
            open: false,
        };
    },
    methods: {
        openMenu() {
            this.$emit("openMenu");
            this.open = true;
        },

        handleFocusOut(e) {
            if (e.relatedTarget != null && this.$el.contains(e.relatedTarget)) {
                return;
            }
            this.open = false;
        },
    },
};
</script>

<style lang="scss">
@import "../assets/vars.scss";
@import "../assets/app.scss";

.filter-dropdown-menu {
    z-index: 100;
    transition: all 0.2s;
    padding: 8px 0 !important;
    border-radius: 16px;
    overflow: hidden;

    position: absolute;
    inset: 0 auto auto 0;
    margin: 0;
    transform: translate(0, 36px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    visibility: hidden;
    list-style: none;
    height: 0;
    opacity: 0;
    background: #0f172a !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    color: #f8fafc !important;

    &.open {
        height: unset;
        visibility: inherit;
        opacity: 1;
    }

    .dropdown-item {
        padding: 8px 16px;
        color: #cbd5e1 !important;
        font-weight: 500;
        cursor: pointer;

        &:hover, &:focus {
            background-color: rgba(255, 255, 255, 0.08) !important;
            color: #ffffff !important;
        }

        &.active {
            color: #34d399 !important;
            background-color: rgba(16, 185, 129, 0.15) !important;
        }
    }
}

.filter-dropdown-status {
    display: flex;
    align-items: center;
    padding: 6px 14px;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    border-radius: 25px;
    background-color: rgba(30, 41, 59, 0.6) !important;
    color: #cbd5e1 !important;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover, &:focus, &.active, &.open {
        border-color: #10b981 !important;
        background-color: rgba(16, 185, 129, 0.15) !important;
        color: #34d399 !important;
    }
}

.filter-active {
    color: #34d399;
}
</style>
