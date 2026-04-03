import { useState } from 'react';
import LandingPage from './components/LandingPage';
import Onboarding from './components/Onboarding';
import CrewAIReport from './components/CrewAIReport';
import AgentBuilder from './components/AgentBuilder';
import WorkflowVisualizer from './components/WorkflowVisualizer';
import AgentChat from './components/AgentChat';
import Dashboard from './components/Dashboard';
import type { ProviderInfo, WorkflowGraph } from './types';

export default function App() {
  // 0: Landing → 1: Onboarding → 2: Report → 3: Agent Builder → 4: Workflow → 5: Chat → 6: Dashboard
  const [step, setStep] = useState<number>(0);
  const [businessContext, setBusinessContext] = useState('');
  const [researchReport, setResearchReport] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentScript, setAgentScript] = useState('');
  const [providerInfo, setProviderInfo] = useState<ProviderInfo>({ provider: '', model: '' });
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {step === 0 && (
        <LandingPage
          onGetStarted={(idea) => { setBusinessContext(idea || ''); setStep(1); }}
          onOpenDashboard={() => setStep(6)}
        />
      )}

      {step === 1 && (
        <Onboarding
          onComplete={(context, report) => {
            setBusinessContext(context);
            setResearchReport(report);
            setStep(2);
          }}
          onSkip={() => {
            setBusinessContext(businessContext || 'Direct build mode: no onboarding context was provided.');
            setStep(3);
          }}
        />
      )}

      {step === 2 && (
        <CrewAIReport
          report={researchReport}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <AgentBuilder
          businessContext={businessContext}
          onComplete={(id, name, workflow, script, provider, model) => {
            setAgentId(id);
            setAgentName(name);
            setWorkflowGraph(workflow);
            setAgentScript(script);
            setProviderInfo({ provider, model });
            setStep(4);
          }}
        />
      )}

      {step === 4 && (
        <WorkflowVisualizer
          agentName={agentName}
          agentScript={agentScript}
          providerInfo={providerInfo}
          workflowGraph={workflowGraph || { nodes: [], edges: [] }}
          onContinue={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <AgentChat
          agentId={agentId}
          agentName={agentName}
          providerInfo={providerInfo}
          onBack={() => setStep(4)}
          onNewAgent={() => setStep(3)}
          onViewDashboard={() => setStep(6)}
        />
      )}

      {step === 6 && (
        <Dashboard
          onBack={() => setStep(0)}
          onNew={() => setStep(3)}
          onOpenAgent={(id, name, _prompt, provider, model) => {
            setAgentId(id);
            setAgentName(name);
            setProviderInfo({ provider: provider || 'groq', model: model || 'llama-3.3-70b-versatile' });
            setStep(5);
          }}
        />
      )}
    </div>
  );
}
