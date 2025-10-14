import React from 'react';
import GroupedVisibilityTab from './vi/GroupedVisibilityTab';

interface VisibilityIntelligenceTabProps {
  auditId: string;
  domain: string;
  projectId: string;
}

export default function VisibilityIntelligenceTab({ auditId, domain, projectId }: VisibilityIntelligenceTabProps) {
  return (
    <GroupedVisibilityTab 
      auditId={auditId} 
      domain={domain} 
      projectId={projectId} 
    />
  );
}