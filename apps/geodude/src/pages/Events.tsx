export default function Events() {
  console.log('📊 Events page rendering...');
  
  try {
    console.log('📊 Events page: About to return JSX...');
    
    const result = (
      <div className="min-h-screen bg-purple-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-purple-800">EVENTS PAGE WORKS!</h1>
          <p className="text-xl text-purple-600 mt-4">Events page is rendering correctly</p>
          <p className="text-lg text-purple-500 mt-2">Check console for debug logs</p>
        </div>
      </div>
    );
    
    console.log('📊 Events page: JSX created successfully');
    return result;
  } catch (error) {
    console.error('❌ Events page error:', error);
    return (
      <div className="min-h-screen bg-red-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-800">EVENTS PAGE ERROR!</h1>
          <p className="text-xl text-red-600 mt-4">Error: {String(error)}</p>
        </div>
      </div>
    );
  }
}
