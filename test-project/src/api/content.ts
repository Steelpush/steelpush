interface ContentItem {
  id: string;
  title: string;
  description: string;
  category: string;
}

export const getContent = async (): Promise<ContentItem[]> => {
  // Simulated API response
  return [
    {
      id: "1",
      title: "Getting Started Guide",
      description: "Learn how to use our platform effectively",
      category: "guides",
    },
    {
      id: "2",
      title: "Best Practices",
      description: "Follow these tips for optimal results",
      category: "tips",
    },
    {
      id: "3",
      title: "Troubleshooting",
      description: "Common issues and their solutions",
      category: "support",
    },
  ];
};

export const getContentByCategory = async (
  category: string,
): Promise<ContentItem[]> => {
  const allContent = await getContent();
  return allContent.filter((item) => item.category === category);
};
