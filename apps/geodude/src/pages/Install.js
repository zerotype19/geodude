import { jsx as _jsx } from "react/jsx-runtime";
import Shell from "../components/Shell";
import InstallWizard from "../components/InstallWizard";
export default function Install() {
    return (_jsx(Shell, { children: _jsx(InstallWizard, {}) }));
}
