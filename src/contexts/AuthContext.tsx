import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
export type AppRole = 'master' | 'admin' | 'user';
export interface TenantSummary { id:string; nome:string; slug:string; role:AppRole; }
export interface PermissionRow { tenant_id:string; module_key:string; allowed:boolean; }
export interface MePayload { user_id:string; nome:string|null; email:string|null; tenants:TenantSummary[]; permissions:PermissionRow[]; }
interface AuthContextType {user:User|null;session:Session|null;me:MePayload|null;loading:boolean;signIn:(e:string,p:string)=>Promise<{error:Error|null}>;signOut:()=>Promise<void>;userName:string|null;refreshMe:()=>Promise<void>;}
const AuthContext=createContext<AuthContextType|undefined>(undefined);
export function AuthProvider({children}:{children:React.ReactNode}){const[user,setUser]=useState<User|null>(null);const[session,setSession]=useState<Session|null>(null);const[me,setMe]=useState<MePayload|null>(null);const[loading,setLoading]=useState(true);const fetchMe=async()=>{const{data,error}=await supabase.rpc('me');if(error){setMe(null);return;}setMe(data as unknown as MePayload)};useEffect(()=>{const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,next)=>{setSession(next);setUser(next?.user??null);if(next?.user)setTimeout(()=>fetchMe().finally(()=>setLoading(false)),0);else{setMe(null);setLoading(false)}});return()=>subscription.unsubscribe()},[]);const signIn=async(e:string,p:string)=>{const{error}=await supabase.auth.signInWithPassword({email:e,password:p});return{error:error as Error|null}};const signOut=async()=>{await supabase.auth.signOut();setUser(null);setSession(null);setMe(null)};return <AuthContext.Provider value={{user,session,me,loading,signIn,signOut,userName:me?.nome??me?.email?.split('@')[0]??null,refreshMe:fetchMe}}>{children}</AuthContext.Provider>}
export function useAuth(){const c=useContext(AuthContext);if(!c)throw new Error('useAuth must be used within an AuthProvider');return c}
