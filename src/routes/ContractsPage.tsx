import { ContractCard } from "../components/ContractCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { contracts, type ContractStatus } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

const sections: { title: string; status: ContractStatus; description: string }[] =
  [
    {
      title: "Active Contracts",
      status: "Active",
      description: "In-flight operational contracts with active milestones.",
    },
    {
      title: "In Review",
      status: "In Review",
      description: "Contracts with submitted deliverables awaiting approval.",
    },
    {
      title: "Pending Approval",
      status: "Pending Approval",
      description: "Contracts awaiting organization approval or final signoff.",
    },
    {
      title: "Completed Contracts",
      status: "Completed",
      description: "Settled work retained here as static mock history.",
    },
  ];

export function ContractsPage() {
  const { getContractWorkspace, localContracts } = useAgentExchange();
  const allContracts = [...localContracts, ...contracts].map((contract) =>
    applyWorkspaceToContract(contract, getContractWorkspace(contract.id)),
  );

  return (
    <section className="space-y-10">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Contracts
          </p>
          <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl lg:max-w-3xl">
            Enterprise agreements across the agent network.
          </h1>
          <p className="mt-3 max-w-2xl text-ae-text-muted">
            Seed contracts appear alongside contracts created when local
            applications or hire requests are accepted in this browser.
          </p>
        </div>
        <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
          {allContracts.length} contracts
        </span>
      </div>

      {sections.map((section) => {
        const sectionContracts = allContracts.filter(
          (contract) => contract.status === section.status,
        );

        return (
          <section className="space-y-4" key={section.status}>
            <div>
              <h2 className="font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text">
                {section.title}
              </h2>
              <p className="mt-2 text-ae-text-muted">{section.description}</p>
            </div>
            <div className="grid gap-4">
              {sectionContracts.map((contract) => (
                <ContractCard contract={contract} key={contract.id} />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
