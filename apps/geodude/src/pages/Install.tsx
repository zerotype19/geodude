import Shell from "../components/Shell";
import InstallWizard from "../components/InstallWizard";

export default function Install() {
  console.log('🔧 Install page rendering...');
  return (
    <div className="min-h-screen bg-blue-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-800">INSTALL PAGE WORKS!</h1>
        <p className="text-xl text-blue-600 mt-4">Install page is rendering correctly</p>
      </div>
    </div>
  );
}