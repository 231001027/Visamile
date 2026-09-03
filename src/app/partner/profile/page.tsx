import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/ProfileForm";
import { ApiKeyManager } from "@/components/ApiKeyManager";

export const dynamic = "force-dynamic";

export default async function PartnerProfilePage() {
  const session = await getSession();
  const partnerId = session!.partnerId!;

  const [partner, salesPersons, branches, indemnityCountries, accepted, apiKeys] = await Promise.all([
    prisma.partner.findUniqueOrThrow({ where: { id: partnerId } }),
    prisma.salesPerson.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.partnerBranch.findMany({ where: { partnerId }, orderBy: { createdAt: "asc" } }),
    prisma.country.findMany({ where: { indemnityRequired: true }, orderBy: { name: "asc" } }),
    prisma.partnerIndemnityAcceptance.findMany({ where: { partnerId } }),
    prisma.partnerApiKey.findMany({
      where: { partnerId, active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
    }),
  ]);

  const acceptedCountryIds = new Set(accepted.map((a) => a.countryId));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-medium text-ink">Profile</h1>
      <p className="mt-1 text-sm text-ink/60">
        Agent code {partner.agentCode ?? "— assigned once approved"} · Status {partner.status}
      </p>

      <div className="mt-6">
        <ProfileForm
          partner={{
            companyName: partner.companyName,
            contactEmail: partner.contactEmail,
            contactPhone: partner.contactPhone,
            invoiceFrequency: partner.invoiceFrequency,
            contactPersonName: partner.contactPersonName,
            contactPersonEmail: partner.contactPersonEmail,
            contactPersonMobile: partner.contactPersonMobile,
            salesPersonId: partner.salesPersonId,
            financePersonEmail: partner.financePersonEmail,
            gstRegistered: partner.gstRegistered,
            gstNo: partner.gstNo,
            panNo: partner.panNo,
            tanNo: partner.tanNo,
            gstCountry: partner.gstCountry,
            gstState: partner.gstState,
            gstCity: partner.gstCity,
            gstPin: partner.gstPin,
            gstAddress: partner.gstAddress,
            gstDocumentKey: partner.gstDocumentKey,
            gstDocumentStatus: partner.gstDocumentStatus,
            msme: partner.msme,
            bankBeneficiaryName: partner.bankBeneficiaryName,
            bankAccountNo: partner.bankAccountNo,
            bankType: partner.bankType,
            bankName: partner.bankName,
            bankIfsc: partner.bankIfsc,
            cancelChequeKey: partner.cancelChequeKey,
            walletTermsAcceptedAt: partner.walletTermsAcceptedAt ? partner.walletTermsAcceptedAt.toISOString() : null,
          }}
          salesPersons={salesPersons.map((s) => ({ id: s.id, name: s.name }))}
          branches={branches.map((b) => ({ id: b.id, label: b.label, gstNo: b.gstNo, address: b.address }))}
          indemnityCountries={indemnityCountries.map((c) => ({
            id: c.id,
            name: c.name,
            text: c.indemnityText,
            accepted: acceptedCountryIds.has(c.id),
          }))}
        />
      </div>

      <ApiKeyManager
        initialKeys={apiKeys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
