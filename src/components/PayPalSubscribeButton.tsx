"use client";

import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSession } from './SessionContextProvider';
import { Loader2 } from 'lucide-react';

interface PayPalSubscribeButtonProps {
  tierId: string;
  paypalPlanId: string;
  onSubscriptionSuccess: () => void;
}

const PayPalSubscribeButton = ({ tierId, paypalPlanId, onSubscriptionSuccess }: PayPalSubscribeButtonProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [{ isPending }] = usePayPalScriptReducer();

  const createSubscription = async (_data: Record<string, unknown>, _actions: Record<string, unknown>) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to subscribe.", variant: "destructive" });
      return Promise.reject("User not logged in.");
    }

    try {
      const { data: edgeFunctionData, error } = await supabase.functions.invoke('create-paypal-subscription-order', {
        body: {
          paypal_plan_id: paypalPlanId,
          user_id: user.id,
        },
      });

      if (error) {
        throw error;
      }

      console.log('PayPal Subscription Order Created:', edgeFunctionData);
      return edgeFunctionData.id; // Return the PayPal subscription ID
    } catch (error: any) {
      console.error("Error creating PayPal subscription order:", error);
      toast({
        title: "Subscription Error",
        description: `Failed to initiate PayPal subscription: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      return Promise.reject(error);
    }
  };

  const onApprove = async (data: Record<string, unknown>, _actions: Record<string, unknown>) => {
    if (!user) {
      toast({ title: "Error", description: "User session lost during approval.", variant: "destructive" });
      return;
    }

    try {
      const { data: edgeFunctionData, error } = await supabase.functions.invoke('capture-paypal-subscription', {
        body: {
          paypal_subscription_id: data.subscriptionID,
          user_id: user.id,
          subscription_tier_id: tierId,
        },
      });

      if (error) {
        throw error;
      }

      console.log('PayPal Subscription Captured:', edgeFunctionData);
      toast({ title: "Success!", description: "Your subscription has been activated.", variant: "default" });
      onSubscriptionSuccess(); // Callback to refresh parent component data
    } catch (error: any) {
      console.error("Error capturing PayPal subscription:", error);
      toast({
        title: "Subscription Error",
        description: `Failed to activate subscription: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const onError = (err: Record<string, unknown>) => {
    console.error("PayPal Buttons Error:", err);
    toast({
      title: "PayPal Error",
      description: "An error occurred with PayPal. Please try again.",
      variant: "destructive",
    });
  };

  const onCancel = (data: Record<string, unknown>) => {
    console.log("PayPal subscription cancelled:", data);
    toast({
      title: "Subscription Cancelled",
      description: "You have cancelled the PayPal subscription process.",
      variant: "default",
    });
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading PayPal...
      </div>
    );
  }

  return (
    <PayPalButtons
      style={{ layout: "vertical", color: "blue", shape: "rect", label: "subscribe" }}
      createSubscription={createSubscription}
      onApprove={onApprove}
      onError={onError}
      onCancel={onCancel}
    />
  );
};

export default PayPalSubscribeButton;