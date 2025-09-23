"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';

const ManageMcqsPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQs</h1>
      <Card>
        <CardHeader>
          <CardTitle>MCQ Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            This page will allow you to view, edit, and delete existing Multiple Choice Questions.
            (Coming soon!)
          </p>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default ManageMcqsPage;