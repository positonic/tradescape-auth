import { auth } from "~/server/auth";
import { db } from "~/server/db"; // Assuming Prisma client is in ~/server/db
import { redirect } from "next/navigation";
import { Table, Text } from "@mantine/core"; // Using Mantine Table and its parts
import { type VerificationToken } from "@prisma/client"; // For typing

export default async function TokensPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/tokens");
  }

  const userId = session.user.id;

  const verificationTokens = await db.verificationToken.findMany({
    where: {
      userId: userId,
    },
    orderBy: {
      expires: "desc",
    },
  });

  if (!verificationTokens || verificationTokens.length === 0) {
    return (
      <div className="container mx-auto py-10">
        <Text size="xl" fw={700} mb="md">My Tokens</Text>
        <Text>You do not have any active verification tokens.</Text>
      </div>
    );
  }

  const rows = verificationTokens.map((token: VerificationToken) => (
    <Table.Tr key={token.identifier + token.token}>
      <Table.Td>{token.identifier}</Table.Td>
      <Table.Td>{token.token.substring(0, 10)}...</Table.Td>
      <Table.Td>{token.expires.toLocaleString()}</Table.Td>
    </Table.Tr>
  ));

  return (
    <div className="container mx-auto py-10">
      <Text size="xl" fw={700} mb="lg">My Verification Tokens</Text>
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Identifier</Table.Th>
            <Table.Th>Token (Partial)</Table.Th>
            <Table.Th>Expires At</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </div>
  );
}
