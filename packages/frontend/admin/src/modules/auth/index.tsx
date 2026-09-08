import { Button } from '@affine/admin/components/ui/button';
import { Input } from '@affine/admin/components/ui/input';
import { Label } from '@affine/admin/components/ui/label';
import { LocalMindLogo } from '@affine/component/localmind-logo';
import { FeatureType, getUserFeaturesQuery } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import type { FormEvent } from 'react';
import { useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { affineFetch } from '../../fetch-utils';
import { isAdmin, useCurrentUser, useRevalidateCurrentUser } from '../common';

export function Auth() {
  const i18n = useI18n();
  const currentUser = useCurrentUser();
  const revalidate = useRevalidateCurrentUser();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const login = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!emailRef.current || !passwordRef.current) return;
      affineFetch('/api/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({
          email: emailRef.current?.value,
          password: passwordRef.current?.value,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(async response => {
          if (!response.ok) {
            const data = await response.json();
            throw new Error(
              data.message || i18n['com.affine.admin.failed-to-login']()
            );
          }
          return response.json();
        })
        .then(() =>
          affineFetch('/graphql', {
            method: 'POST',
            body: JSON.stringify({
              operationName: getUserFeaturesQuery.op,
              query: getUserFeaturesQuery.query,
              variables: {},
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          })
        )
        .then(res => res.json())
        .then(
          async ({
            data: {
              currentUser: { features },
            },
          }) => {
            if (features.includes(FeatureType.Admin)) {
              toast.success(i18n['com.affine.admin.logged-in-successfully']());
              await revalidate();
            } else {
              toast.error(i18n['com.affine.admin.you-are-not-an-admin']());
            }
          }
        )
        .catch(err => {
          toast.error(`Failed to login: ${err.message}`);
        });
    },
    [revalidate, i18n]
  );

  if (currentUser && isAdmin(currentUser)) {
    return <Navigate to="/admin" />;
  }

  return (
    <div className="w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px] h-dvh">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">
              {i18n['com.affine.payment.ai.action.login.button-label']()}
            </h1>
            <p className="text-balance text-muted-foreground">
              {i18n[
                'com.affine.admin.enter-your-email-below-to-login-to-your-account'
              ]()}{' '}
            </p>
          </div>
          <form onSubmit={login} action="#">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">
                  {i18n['com.affine.settings.email']()}
                </Label>
                <Input
                  id="email"
                  type="email"
                  ref={emailRef}
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">
                    {i18n[
                      'com.affine.integration.calendar.caldav.field.password'
                    ]()}
                  </Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  ref={passwordRef}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button onClick={login} type="submit" className="w-full">
                {i18n['com.affine.payment.ai.action.login.button-label']()}{' '}
              </Button>
            </div>
          </form>
        </div>
      </div>
      <div className="hidden bg-muted lg:flex lg:justify-center">
        <LocalMindLogo
          alt="LocalMind"
          className="h-1/2 w-auto object-contain relative top-1/4"
        />
      </div>
    </div>
  );
}

export { Auth as Component };
