export default function Install() {
  console.log('🔧 Install page rendering...');
  
  try {
    console.log('🔧 Install page: About to return JSX...');
    
    const result = (
      <div className="min-h-screen bg-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-800">INSTALL PAGE WORKS!</h1>
          <p className="text-xl text-blue-600 mt-4">Install page is rendering correctly</p>
          <p className="text-lg text-blue-500 mt-2">Check console for debug logs</p>
        </div>
      </div>
    );
    
    console.log('🔧 Install page: JSX created successfully');
    return result;
  } catch (error) {
    console.error('❌ Install page error:', error);
    return (
      <div className="min-h-screen bg-red-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-800">INSTALL PAGE ERROR!</h1>
          <p className="text-xl text-red-600 mt-4">Error: {String(error)}</p>
        </div>
      </div>
    );
  }
}