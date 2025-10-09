import { useEffect, useState } from "react";

const KEY = "ov_api_key";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string>("");
  
  useEffect(() => { 
    const k = localStorage.getItem(KEY); 
    if (k) setApiKey(k); 
  }, []);
  
  const save = (k: string) => { 
    setApiKey(k); 
    localStorage.setItem(KEY, k); 
  };
  
  const clear = () => { 
    setApiKey(""); 
    localStorage.removeItem(KEY); 
  };
  
  return { apiKey, save, clear };
}

