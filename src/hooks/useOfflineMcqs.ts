"use client";

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { MCQ } from '@/components/mcq-columns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { dismissToast } from '@/utils/toast'; // Fix Error 23, 24

// Define the structure of the nested MCQ data from Supabase join
interface SupabaseMcqData {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  difficulty: string | null;
  is_trial_mcq: boolean | null;
}

// Define the structure of the links data from Supabase join
interface SupabaseLinkData {
  mcq_id: string;
  category_id: string;
  mcqs: SupabaseMcqData | null;
}

// Define the structure of the data stored locally
interface LocalMCQ extends Omit<MCQ, 'category_links'> {
  category_ids_json: string; // Store category IDs as JSON string
  explanation_text: string;
  image_url: string | null;
}

// Fix Error 1: Removed explicit SQLiteHook type as it's not exported directly
const useSQLite = CapacitorSQLite;

export const useOfflineMcqs = () => {
  const { toast } = useToast();
  const [db, setDb] = useState<SQLiteDBConnection | null>(null);
  const [isDbInitialized, setIsDbInitialized] = useState(false);

  const initializeDb = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log("Not running on a native platform, skipping SQLite initialization.");
      setIsDbInitialized(true);
      return;
    }

    try {
      const dbName = "offline_mcqs_db";
      const _ret = await useSQLite.checkConnectionsConsistency(); // Fix Error 3
      const isConn = (await useSQLite.isConnection(dbName, false)).result;
      
      let database: SQLiteDBConnection;

      if (isConn) {
        database = await useSQLite.retrieveConnection(dbName, false);
      } else {
        database = await useSQLite.createConnection(dbName, false, "no-encryption", 1, false);
      }

      await database.open();
      setDb(database);

      // Define the schema for MCQs and Explanations
      const schema = `
        CREATE TABLE IF NOT EXISTS mcqs (
          id TEXT PRIMARY KEY NOT NULL,
          question_text TEXT NOT NULL,
          option_a TEXT NOT NULL,
          option_b TEXT NOT NULL,
          option_c TEXT NOT NULL,
          option_d TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          difficulty TEXT,
          is_trial_mcq INTEGER,
          category_ids_json TEXT
        );
        CREATE TABLE IF NOT EXISTS mcq_explanations (
          id TEXT PRIMARY KEY NOT NULL,
          explanation_text TEXT NOT NULL,
          image_url TEXT
        );
      `;
      await database.execute(schema);
      setIsDbInitialized(true);
      console.log("SQLite Database initialized successfully.");
    } catch (e: any) {
      console.error("Error initializing SQLite DB:", e);
      toast({
        title: "Offline Error",
        description: "Failed to initialize local database for offline study.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    initializeDb();
  }, [initializeDb]);

  const fetchAndStoreMcqs = useCallback(async (categoryIds: string[], limit: number) => {
    if (!db || !isDbInitialized) {
      toast({ title: "Error", description: "Local database is not ready.", variant: "destructive" });
      return { success: false, count: 0 };
    }

    const loadingToastId = toast({
      title: "Downloading MCQs...",
      description: "Fetching questions and explanations from the server.",
      duration: 999999,
    });

    try {
      // 1. Fetch MCQs and their links based on categoryIds
      let mcqsQuery = supabase
        .from('mcq_category_links')
        .select(`
          mcq_id,
          category_id,
          mcqs (
            id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation_id, difficulty, is_trial_mcq
          )
        `)
        .in('category_id', categoryIds)
        .limit(limit);

      const { data: linksData, error: linksError } = await mcqsQuery as { data: SupabaseLinkData[] | null, error: any };

      if (linksError) throw linksError;

      const uniqueMcqIds = Array.from(new Set(linksData.map(link => link.mcq_id)));
      if (uniqueMcqIds.length === 0) {
        dismissToast(loadingToastId.id);
        toast({ title: "Info", description: "No MCQs found for the selected categories.", variant: "default" });
        return { success: true, count: 0 };
      }

      // 2. Fetch explanations for all unique MCQs (Fixes Errors 4, 5)
      const explanationIdsToFetch = Array.from(new Set(linksData.map(l => l.mcqs?.explanation_id).filter((id): id is string => !!id)));
      
      const { data: explanationsData, error: expError } = await supabase
        .from('mcq_explanations')
        .select('*')
        .in('id', explanationIdsToFetch);

      if (expError) throw expError;
      const explanationMap = new Map(explanationsData.map(exp => [exp.id, exp]));

      // 3. Prepare data for local storage (Fixes Errors 6-22)
      const mcqMap = new Map<string, LocalMCQ>();
      const mcqCategoryMap = new Map<string, string[]>();

      linksData.forEach(link => {
        const mcq = link.mcqs;
        if (mcq) {
          // Aggregate category IDs
          if (!mcqCategoryMap.has(mcq.id)) {
            mcqCategoryMap.set(mcq.id, []);
          }
          mcqCategoryMap.get(mcq.id)?.push(link.category_id);

          // Prepare MCQ data
          if (!mcqMap.has(mcq.id)) {
            const explanation = explanationMap.get(mcq.explanation_id || '');
            mcqMap.set(mcq.id, {
              id: mcq.id,
              question_text: mcq.question_text,
              option_a: mcq.option_a,
              option_b: mcq.option_b,
              option_c: mcq.option_c,
              option_d: mcq.option_d,
              correct_answer: mcq.correct_answer,
              explanation_id: mcq.id, // Use MCQ ID as explanation ID for local data
              difficulty: mcq.difficulty,
              is_trial_mcq: mcq.is_trial_mcq,
              explanation_text: explanation?.explanation_text || "No explanation available offline.",
              image_url: explanation?.image_url || null,
              category_ids_json: JSON.stringify(mcqCategoryMap.get(mcq.id) || []),
            });
          }
        }
      });

      const mcqsToStore = Array.from(mcqMap.values());

      // 4. Store data locally (using transactions for efficiency)
      const mcqValues = mcqsToStore.map(m => `(
        '${m.id}', 
        '${m.question_text.replace(/'/g, "''")}', 
        '${m.option_a.replace(/'/g, "''")}', 
        '${m.option_b.replace(/'/g, "''")}', 
        '${m.option_c.replace(/'/g, "''")}', 
        '${m.option_d.replace(/'/g, "''")}', 
        '${m.correct_answer}', 
        '${m.difficulty || ''}', 
        ${m.is_trial_mcq ? 1 : 0}, 
        '${m.category_ids_json.replace(/'/g, "''")}'
      )`).join(', ');

      const explanationValues = mcqsToStore.map(m => `(
        '${m.id}', 
        '${m.explanation_text.replace(/'/g, "''")}', 
        '${m.image_url || ''}'
      )`).join(', ');

      const insertMcqs = `INSERT OR REPLACE INTO mcqs (id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty, is_trial_mcq, category_ids_json) VALUES ${mcqValues};`;
      const insertExplanations = `INSERT OR REPLACE INTO mcq_explanations (id, explanation_text, image_url) VALUES ${explanationValues};`;

      await db.executeSet([
        { statement: insertMcqs, values: [] },
        { statement: insertExplanations, values: [] },
      ]);

      dismissToast(loadingToastId.id);
      toast({
        title: "Download Complete",
        description: `${mcqsToStore.length} MCQs downloaded for offline study.`,
      });
      return { success: true, count: mcqsToStore.length };

    } catch (e: any) {
      dismissToast(loadingToastId.id);
      console.error("Error downloading and storing MCQs:", e);
      toast({
        title: "Download Failed",
        description: `Failed to download MCQs: ${e.message || 'Unknown error'}`,
        variant: "destructive",
      });
      return { success: false, count: 0 };
    }
  }, [db, isDbInitialized, toast]);

  const getOfflineMcqs = useCallback(async (mcqIds: string[]): Promise<MCQ[]> => {
    if (!db || !isDbInitialized) return [];

    try {
      const idsString = mcqIds.map(id => `'${id}'`).join(',');
      const query = `
        SELECT 
          m.*, 
          e.explanation_text, 
          e.image_url 
        FROM mcqs m
        JOIN mcq_explanations e ON m.id = e.id
        WHERE m.id IN (${idsString});
      `;
      
      const result = await db.query(query);
      
      // Fix Error 25
      return (result.values || []).map((row: any) => ({
        id: row.id,
        question_text: row.question_text,
        option_a: row.option_a,
        option_b: row.option_b,
        option_c: row.option_c,
        option_d: row.option_d,
        correct_answer: row.correct_answer,
        explanation_id: row.id, // Use MCQ ID as explanation ID for local data
        difficulty: row.difficulty,
        is_trial_mcq: row.is_trial_mcq === 1,
        category_links: JSON.parse(row.category_ids_json).map((catId: string) => ({
          category_id: catId,
          category_name: "Offline Category", // Placeholder, actual name needs to be fetched separately or stored
        })),
        // Add explanation details directly to the object for easy access
        explanation_text: row.explanation_text,
        image_url: row.image_url,
      })) as MCQ[];

    } catch (e) {
      console.error("Error retrieving offline MCQs:", e);
      return [];
    }
  }, [db, isDbInitialized]);

  const getOfflineMcqIdsByCategory = useCallback(async (categoryId: string): Promise<string[]> => {
    if (!db || !isDbInitialized) return [];

    try {
      const query = `
        SELECT id, category_ids_json FROM mcqs;
      `;
      
      const result = await db.query(query);
      
      const matchingIds: string[] = [];
      // Fix Error 26
      (result.values || []).forEach((row: any) => {
        try {
          const categoryIds = JSON.parse(row.category_ids_json);
          if (Array.isArray(categoryIds) && categoryIds.includes(categoryId)) {
            matchingIds.push(row.id);
          }
        } catch (e) {
          console.error("Error parsing category IDs for MCQ:", row.id, e);
        }
      });
      return matchingIds;

    } catch (e) {
      console.error("Error retrieving offline MCQ IDs by category:", e);
      return [];
    }
  }, [db, isDbInitialized]);

  const getOfflineCategoryCounts = useCallback(async (): Promise<Map<string, number>> => {
    if (!db || !isDbInitialized) return new Map();

    try {
      const query = `SELECT category_ids_json FROM mcqs;`;
      const result = await db.query(query);
      
      const counts = new Map<string, number>();
      // Fix Error 27
      (result.values || []).forEach((row: any) => {
        try {
          const categoryIds = JSON.parse(row.category_ids_json);
          if (Array.isArray(categoryIds)) {
            categoryIds.forEach(catId => {
              counts.set(catId, (counts.get(catId) || 0) + 1);
            });
          }
        } catch (e) {
          // Ignore parsing errors for individual rows
        }
      });
      return counts;
    } catch (e) {
      console.error("Error retrieving offline category counts:", e);
      return new Map();
    }
  }, [db, isDbInitialized]);

  return {
    isDbInitialized,
    fetchAndStoreMcqs,
    getOfflineMcqs,
    getOfflineMcqIdsByCategory,
    getOfflineCategoryCounts,
    isNative: Capacitor.isNativePlatform(),
  };
};

export default useOfflineMcqs;