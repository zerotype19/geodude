export default function TestPage() {
  console.log('🧪 TestPage component rendering...');
  
  return (
    <div className="min-h-screen bg-red-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-800">TEST PAGE WORKS!</h1>
        <p className="text-xl text-red-600 mt-4">If you can see this, routing is working</p>
        <p className="text-lg text-red-500 mt-2">Check console for debug logs</p>
      </div>
    </div>
  );
}
