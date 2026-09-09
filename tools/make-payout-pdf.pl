#!/usr/bin/perl
# Bouwt payout-statement.pdf. Geen bibliotheken op deze machine, dus de PDF
# wordt hier zelf samengesteld: objecten, een tekststroom en een xref-tabel
# met de byte-offsets die dit script uitrekent.
use strict;
use warnings;

my $W = 595.28;   # A4 in punten
my $H = 841.89;
my $M = 56;       # marge

my @ops;

sub esc {
  my ($s) = @_;
  $s =~ s/\\/\\\\/g;
  $s =~ s/\(/\\(/g;
  $s =~ s/\)/\\)/g;
  return $s;
}

# tekst: x, y (vanaf boven), font, grootte, grijswaarde, inhoud
sub tekst {
  my ($x, $y, $font, $size, $grijs, $s) = @_;
  push @ops, sprintf("BT /%s %.1f Tf %.3f g %.2f %.2f Td (%s) Tj ET",
    $font, $size, $grijs, $x, $H - $y, esc($s));
}

# rechts uitgelijnd: Helvetica-breedtes benaderen met 0.5 em is te grof, dus
# we meten met de breedtetabel van de standaardfonts (alleen wat we nodig
# hebben: cijfers, punt, komma, spatie, hoofdletters, kleine letters).
my %w = (' ' => 278, ',' => 278, '.' => 278, '-' => 333, '\'' => 191,
         map { $_ => 556 } ('0'..'9'));
sub breedte {
  my ($s, $size) = @_;
  my $t = 0;
  for my $c (split //, $s) {
    $t += exists $w{$c} ? $w{$c} : ($c =~ /[A-Z]/ ? 667 : 556);
  }
  return $t * $size / 1000;
}
sub rechts {
  my ($x, $y, $font, $size, $grijs, $s) = @_;
  tekst($x - breedte($s, $size), $y, $font, $size, $grijs, $s);
}

sub lijn {
  my ($y, $grijs) = @_;
  push @ops, sprintf("%.3f G 0.7 w %.2f %.2f m %.2f %.2f l S",
    $grijs, $M, $H - $y, $W - $M, $H - $y);
}

sub vlak {
  my ($y, $hoogte, $grijs) = @_;
  push @ops, sprintf("%.3f g %.2f %.2f %.2f %.2f re f",
    $grijs, $M, $H - $y - $hoogte, $W - 2 * $M, $hoogte);
}

# ---- kop ------------------------------------------------------------------
tekst($M, 74, 'Helvetica-Bold', 13, 0.05, 'Opining');
rechts($W - $M, 74, 'Helvetica', 9.5, 0.45, 'Generated on 9 September 2026');
lijn(88, 0.85);

tekst($M, 128, 'Helvetica-Bold', 22, 0.05, 'Payout statement');
tekst($M, 150, 'Helvetica', 10.5, 0.45, 'Payout PO-2026-0161 to Opining B.V.');

# ---- gegevens -------------------------------------------------------------
my @rijen = (
  ['Payout date',   'Friday 21 August 2026'],
  ['Period',        '15 August 2026 - 21 August 2026'],
  ['Deposited to',  'NL** **** **** 4821'],
  ['Reference',     'OPN-PO-20260821'],
  ['Status',        'In transit'],
);
my $y = 196;
for my $r (@rijen) {
  tekst($M, $y, 'Helvetica', 10.5, 0.45, $r->[0]);
  tekst($M + 150, $y, 'Helvetica', 10.5, 0.1, $r->[1]);
  $y += 22;
}

# ---- samenvatting ---------------------------------------------------------
$y += 18;
tekst($M, $y, 'Helvetica-Bold', 12, 0.05, 'Summary');
$y += 12;
lijn($y, 0.85);
$y += 24;

my @sum = (
  ['Gross sales',                                  'EUR 5.412,90'],
  ['Refunds',                                      'EUR -318,40'],
  ['Chargebacks',                                  'EUR -95,00'],
  ['Payment fees (96 iDEAL x 0,35 + 28 PayPal x 0,29)', 'EUR -41,72'],
  ['Opining commission',                           'EUR -145,13'],
);
for my $r (@sum) {
  tekst($M, $y, 'Helvetica', 10.5, 0.25, $r->[0]);
  rechts($W - $M, $y, 'Helvetica', 10.5, 0.1, $r->[1]);
  $y += 22;
}
$y += 2;
lijn($y - 14, 0.85);
vlak($y - 8, 30, 0.96);
tekst($M + 12, $y + 12, 'Helvetica-Bold', 11.5, 0.05, 'Net payout');
rechts($W - $M - 12, $y + 12, 'Helvetica-Bold', 11.5, 0.05, 'EUR 4.812,65');
$y += 52;

# ---- orders ---------------------------------------------------------------
$y += 16;
tekst($M, $y, 'Helvetica-Bold', 12, 0.05, 'Orders in this payout');
rechts($W - $M, $y, 'Helvetica', 9, 0.5, 'Order number: YYMMDD, block letter, order of that day');
$y += 12;
lijn($y, 0.85);
$y += 22;

tekst($M, $y, 'Helvetica', 9.5, 0.45, 'Date');
tekst($M + 90, $y, 'Helvetica', 9.5, 0.45, 'Order');
tekst($M + 180, $y, 'Helvetica', 9.5, 0.45, 'Type');
tekst($M + 255, $y, 'Helvetica', 9.5, 0.45, 'Payment');
rechts($M + 400, $y, 'Helvetica', 9.5, 0.45, 'Fee');
rechts($W - $M, $y, 'Helvetica', 9.5, 0.45, 'Amount');
$y += 8;
lijn($y, 0.92);
$y += 20;

my @orders = (
  ['20 Aug 2026', '260820A14', 'Delivery', 'iDEAL',  'EUR 0,35', 'EUR 73,59'],
  ['20 Aug 2026', '260820A13', 'Takeaway', 'iDEAL',  'EUR 0,35', 'EUR 41,20'],
  ['19 Aug 2026', '260819A11', 'Delivery', 'PayPal', 'EUR 0,29', 'EUR 68,45'],
  ['19 Aug 2026', '260819A09', 'Delivery', 'iDEAL',  'EUR 0,35', 'EUR 52,10'],
  ['18 Aug 2026', '260818A07', 'Takeaway', 'PayPal', 'EUR 0,29', 'EUR 39,90'],
  ['17 Aug 2026', '260817A12', 'Delivery', 'iDEAL',  'EUR 0,35', 'EUR 84,15'],
);
for my $o (@orders) {
  tekst($M, $y, 'Helvetica', 10, 0.25, $o->[0]);
  tekst($M + 90, $y, 'Helvetica', 10, 0.25, $o->[1]);
  tekst($M + 180, $y, 'Helvetica', 10, 0.25, $o->[2]);
  tekst($M + 255, $y, 'Helvetica', 10, 0.25, $o->[3]);
  rechts($M + 400, $y, 'Helvetica', 10, 0.45, $o->[4]);
  rechts($W - $M, $y, 'Helvetica', 10, 0.1, $o->[5]);
  $y += 20;
}
$y += 2;
lijn($y - 12, 0.92);
tekst($M, $y + 6, 'Helvetica', 10, 0.45, '124 orders in total, of which 6 shown above.');

# ---- voet -----------------------------------------------------------------
lijn($H - 96, 0.85);
tekst($M, $H - 76, 'Helvetica', 9, 0.5,
  'Opining B.V. - Lusthofstraat 27A, 3062 WB Rotterdam - KVK 87654321 - VAT NL863254789B01');
tekst($M, $H - 62, 'Helvetica', 9, 0.5,
  'Questions about this payout? Reply to payouts@opining.com and quote the reference above.');

# ---- objecten ------------------------------------------------------------
my $stroom = join("\n", @ops);
my @obj;
$obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
$obj[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
$obj[3] = sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
  . "/Resources << /Font << /Helvetica 5 0 R /Helvetica-Bold 6 0 R >> >> "
  . "/Contents 4 0 R >>", $W, $H);
$obj[4] = "<< /Length " . length($stroom) . " >>\nstream\n$stroom\nendstream";
$obj[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
$obj[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

my $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
my @offset;
for my $i (1 .. 6) {
  $offset[$i] = length($pdf);
  $pdf .= "$i 0 obj\n$obj[$i]\nendobj\n";
}
my $start = length($pdf);
$pdf .= "xref\n0 7\n0000000000 65535 f \n";
$pdf .= sprintf("%010d 00000 n \n", $offset[$_]) for 1 .. 6;
$pdf .= "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n$start\n%%EOF\n";

my $uit = $ARGV[0] or die "geef een bestandsnaam\n";
open my $fh, '>:raw', $uit or die "kan $uit niet schrijven: $!";
print $fh $pdf;
close $fh;
print "ok: $uit (", length($pdf), " bytes)\n";
