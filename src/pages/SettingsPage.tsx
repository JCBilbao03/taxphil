import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your registered taxpayer information with the BIR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" defaultValue="Juan Dela Cruz" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tin">TIN</Label>
              <Input id="tin" defaultValue="123-456-789-000" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="businessName">Registered business name</Label>
              <Input id="businessName" defaultValue="JDC Professional Services" />
            </div>
          </div>
          <Button>Save profile</Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Tax registration</CardTitle>
          <CardDescription>
            Configure your taxpayer type and applicable BIR forms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxType">Taxpayer type</Label>
            <Input id="taxType" defaultValue="Self-Employed / Professional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rdo">Revenue District Office (RDO)</Label>
            <Input id="rdo" defaultValue="RDO 39 — South QC" />
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            TaxPhil auto-calculates 2551Q (Percentage Tax) and 1701Q (Quarterly
            Income Tax) based on your logged transactions.
          </p>
          <Button variant="outline">Update registration</Button>
        </CardContent>
      </Card>
    </div>
  )
}
