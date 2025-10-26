import React, { useState, useEffect } from 'react';

interface TourStep {
  target: string; // CSS selector or ID
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void; // Optional action to perform when this step starts
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="overview-tab"]',
    title: ' Overview Tab',
    content: 'See your AEO and GEO scores, Top Blockers (high-impact issues), and Quick Wins (easy fixes). This is your starting point for improving your site.',
    position: 'bottom'
  },
  {
    target: '[data-tour="pages-tab"]',
    title: ' Pages Tab',
    content: 'Browse all analyzed pages with individual scores. Click any page to see detailed evidence for each check.',
    position: 'bottom'
  },
  {
    target: '[data-tour="citations-tab"]',
    title: ' Citations Tab',
    content: 'Test if your brand appears in real LLM responses from ChatGPT, Claude, Perplexity, and Brave. Click here to switch to the Citations tab.',
    position: 'bottom',
    action: () => {
      // Click the Citations tab when this step starts
      const citationsTab = document.querySelector('[data-tour="citations-tab"]') as HTMLButtonElement;
      if (citationsTab) {
        citationsTab.click();
      }
    }
  },
  {
    target: '[data-tour="run-citations-button"]',
    title: '▶️ Run Citations Button',
    content: 'Click this button to start live LLM testing! We\'ll query ChatGPT, Claude, Perplexity, and Brave with branded and non-branded queries to see if your site appears in responses.',
    position: 'top'
  }
];

const TOUR_STORAGE_KEY = 'optiview_audit_tour_completed';

export default function AuditTour() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    // Check if tour has been completed
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    
    if (!tourCompleted) {
      // Wait a moment for the page to render, then start tour
      const timer = setTimeout(() => {
        setIsActive(true);
        updatePosition(0);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      updatePosition(currentStep);
    }
  }, [currentStep, isActive]);

  const updatePosition = (stepIndex: number) => {
    const step = TOUR_STEPS[stepIndex];
    
    // Execute step action if present
    if (step.action) {
      step.action();
      // Wait a moment for the action to complete before positioning
      setTimeout(() => positionTooltip(stepIndex), 300);
    } else {
      positionTooltip(stepIndex);
    }
  };

  const positionTooltip = (stepIndex: number) => {
    const step = TOUR_STEPS[stepIndex];
    const element = document.querySelector(step.target);
    
    if (element) {
      const rect = element.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 150; // Approximate
      
      let top = rect.bottom + window.scrollY + 10;
      let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);
      
      // Adjust position based on preference
      if (step.position === 'top') {
        top = rect.top + window.scrollY - tooltipHeight - 10;
      }
      
      // Keep tooltip within viewport
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      
      setPosition({ top, left });
      
      // Highlight the target element
      (element as HTMLElement).style.position = 'relative';
      (element as HTMLElement).style.zIndex = '10000';
      
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNext = () => {
    // Clean up previous step's highlight
    const prevStep = TOUR_STEPS[currentStep];
    const prevElement = document.querySelector(prevStep.target);
    if (prevElement) {
      (prevElement as HTMLElement).style.position = '';
      (prevElement as HTMLElement).style.zIndex = '';
    }
    
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    // Clean up any highlighted elements
    TOUR_STEPS.forEach(step => {
      const element = document.querySelector(step.target);
      if (element) {
        (element as HTMLElement).style.position = '';
        (element as HTMLElement).style.zIndex = '';
      }
    });
    
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsActive(false);
  };

  if (!isActive || !position) {
    return null;
  }

  const step = TOUR_STEPS[currentStep];

  return (
    <>
      {/* Backdrop - lighter so content is visible */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-[9998]"
        onClick={handleSkip}
      />
      
      {/* Tooltip */}
      <div
        className="fixed z-[9999] bg-surface-1 rounded-lg shadow-2xl border-2 border-brand p-6 max-w-sm animate-fadeIn"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        {/* Progress indicator */}
        <div className="flex items-center gap-1 mb-3">
          {TOUR_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full ${
                index === currentStep ? 'bg-brand' : index < currentStep ? 'bg-brand-soft' : 'bg-surface-3'
              }`}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="mb-4">
          <h3 className="text-lg font-bold  mb-2 flex items-center">
            {step.title}
            {currentStep === 3 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-soft text-success">
                Click this!
              </span>
            )}
          </h3>
          <p className="text-sm muted leading-relaxed">
            {step.content}
          </p>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm subtle hover:muted transition-colors"
          >
            Skip tour
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-xs subtle">
              {currentStep + 1} of {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleNext}
              className="bg-brand hover:bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {currentStep < TOUR_STEPS.length - 1 ? 'Next' : 'Got it!'}
            </button>
          </div>
        </div>
        
        {/* Arrow indicator */}
        <div
          className="absolute w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white"
          style={{
            top: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

