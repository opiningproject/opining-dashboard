#!/usr/bin/perl
# Bouwt payout-statement.pdf: het overzicht achter "See details" op Finance.
#
# Geen factuur maar een tussenstand: alle orders van de lopende periode onder
# elkaar, per order het bedrag dat binnenkwam en de transactiekosten die eraf
# gaan, met een doorlopend saldo ernaast. De laatste saldoregel is wat er
# uitbetaald wordt, en dat is hetzelfde bedrag als op de balanskaart in het
# dashboard.
#
# Er staat geen PDF-bibliotheek op de bouwmachine, dus het formaat wordt hier
# zelf samengesteld: objecten, een tekststroom per pagina en een xref-tabel met
# de byte-offsets die dit script uitrekent. In productie maakt de server dit.
use strict;
use warnings;

my $W = 595.28;          # A4 in punten
my $H = 841.89;
my $M = 44;              # marge: smal, het is een tabel
my $ONDER = $H - 64;     # hieronder past geen regel meer

# kolommen, gemeten vanaf de linkermarge
my $K_ORDER = 78;
my $K_OMS   = 168;
my $K_BEDRAG = 400;      # rechts uitgelijnd
my $K_SALDO = $W - $M;   # rechts uitgelijnd

my @paginas;
my @ops;

sub esc {
  my ($s) = @_;
  $s =~ s/\\/\\\\/g;
  $s =~ s/\(/\\(/g;
  $s =~ s/\)/\\)/g;
  return $s;
}
sub tekst {
  my ($x, $y, $font, $size, $grijs, $s) = @_;
  push @ops, sprintf("BT /%s %.1f Tf %.3f g %.2f %.2f Td (%s) Tj ET",
    $font, $size, $grijs, $x, $H - $y, esc($s));
}
my %w = (' ' => 278, ',' => 278, '.' => 278, '-' => 333, '+' => 584,
         map { $_ => 556 } ('0'..'9'));
sub breedte {
  my ($s, $size) = @_;
  my $t = 0;
  $t += (exists $w{$_} ? $w{$_} : ($_ =~ /[A-Z]/ ? 667 : 556)) for split //, $s;
  return $t * $size / 1000;
}
sub rechts {
  my ($x, $y, $font, $size, $grijs, $s) = @_;
  tekst($x - breedte($s, $size), $y, $font, $size, $grijs, $s);
}
sub lijn {
  my ($y, $grijs, $dik) = @_;
  push @ops, sprintf("%.3f G %.1f w %.2f %.2f m %.2f %.2f l S",
    $grijs, $dik || 0.5, $M, $H - $y, $W - $M, $H - $y);
}
sub band {
  my ($y, $hoogte, $grijs) = @_;
  push @ops, sprintf("%.3f g %.2f %.2f %.2f %.2f re f",
    $grijs, $M, $H - $y - $hoogte, $W - 2 * $M, $hoogte);
}

sub euro {
  my ($c) = @_;
  my $min = $c < 0 ? '-' : '';
  $c = abs $c;
  my $heel = int($c / 100);
  my $rest = sprintf("%02d", $c % 100);
  1 while $heel =~ s/(\d)(\d{3})(?!\d)/$1.$2/;
  return "$min$heel,$rest";
}

# ---- de orders -------------------------------------------------------------
# Vaste reeks, zodat het bestand bij elke bouw identiek is.
my $zaad = 20260821;
sub trek { $zaad = ($zaad * 1103515245 + 12345) % 2147483648; return $zaad; }

my %kosten = ('iDEAL' => 35, 'PayPal' => 29);
my @dagen = ('15 Aug 2026', '16 Aug 2026', '17 Aug 2026', '18 Aug 2026',
             '19 Aug 2026', '20 Aug 2026', '21 Aug 2026');
my @code  = ('260815', '260816', '260817', '260818', '260819', '260820', '260821');
my @perdag = (16, 17, 18, 19, 18, 19, 17);   # samen 124

my @orders;
my $ideal_over = 96;
for my $d (0 .. $#dagen) {
  for my $n (1 .. $perdag[$d]) {
    my $bedrag = 1500 + trek() % 5700;       # 15,00 tot 72,00
    my $methode = ($ideal_over > 0 && trek() % 4) ? 'iDEAL' : 'PayPal';
    $ideal_over-- if $methode eq 'iDEAL';
    push @orders, {
      dag     => $dagen[$d],
      nummer  => sprintf("%sA%02d", $code[$d], $n),
      soort   => (trek() % 3 ? 'Delivery' : 'Takeaway'),
      methode => $methode,
      bedrag  => $bedrag,
      kosten  => $kosten{$methode},
    };
  }
}

my ($bruto, $fees) = (0, 0);
my %aantal;
for my $o (@orders) {
  $bruto += $o->{bedrag};
  $fees  += $o->{kosten};
  $aantal{$o->{methode}}++;
}
my $refunds     = 31840;
my $chargebacks = 9500;
# Het abonnement is een vast maandbedrag, dus er gaat geen commissie per order
# af. Wat binnenkwam min de kosten is wat er wordt uitbetaald; index.html toont
# datzelfde bedrag op de balanskaart.
my $netto = $bruto - $fees - $refunds - $chargebacks;

# ---- pagina-onderdelen -----------------------------------------------------
my $y;
my $regel = 0;           # voor de banding

sub tabelkop {
  band($y - 11, 17, 0.94);
  tekst($M + 4, $y, 'Helvetica-Bold', 8.5, 0.35, 'DATE');
  tekst($M + $K_ORDER, $y, 'Helvetica-Bold', 8.5, 0.35, 'ORDER');
  tekst($M + $K_OMS, $y, 'Helvetica-Bold', 8.5, 0.35, 'DESCRIPTION');
  rechts($M + $K_BEDRAG, $y, 'Helvetica-Bold', 8.5, 0.35, 'AMOUNT');
  rechts($K_SALDO - 4, $y, 'Helvetica-Bold', 8.5, 0.35, 'BALANCE');
  $y += 15;
}

sub paginakop {
  tekst($M, 40, 'Helvetica-Bold', 9.5, 0.15, 'Opining');
  tekst($M + 60, 40, 'Helvetica', 9.5, 0.45,
    'Payout PO-2026-0161 - 15 to 21 August 2026 - interim');
  lijn(48, 0.8);
}

sub nieuwe_pagina {
  push @paginas, [@ops];
  @ops = ();
  paginakop();
  $y = 76;
  tabelkop();
}

sub ruimte {
  my ($nodig) = @_;
  nieuwe_pagina() if $y + $nodig > $ONDER;
}

# regel: omschrijving, bedrag (centen), saldo (centen), stijl
sub boeking {
  my ($dag, $nummer, $oms, $bedrag, $saldo, $vet) = @_;
  band($y - 10, 15, 0.975) if $regel % 2;
  $regel++;
  my $font = $vet ? 'Helvetica-Bold' : 'Helvetica';
  my $grijs = $vet ? 0.1 : 0.3;
  tekst($M + 4, $y, $font, 8.5, $grijs, $dag) if $dag;
  tekst($M + $K_ORDER, $y, $font, 8.5, $grijs, $nummer) if $nummer;
  tekst($M + $K_OMS, $y, $font, 8.5, $grijs, $oms);
  rechts($M + $K_BEDRAG, $y, $font, 8.5, $bedrag < 0 ? 0.45 : $grijs,
    ($bedrag > 0 ? '+ ' : '- ') . euro(abs $bedrag));
  rechts($K_SALDO - 4, $y, $font, 8.5, $grijs, euro($saldo)) if defined $saldo;
  $y += 15;
}

# ---- pagina 1 --------------------------------------------------------------
paginakop();
$y = 82;
tekst($M, $y, 'Helvetica-Bold', 17, 0.05, 'Payout in progress');
$y += 18;
tekst($M, $y, 'Helvetica', 9.5, 0.45,
  'Every order in this period with its transaction fee, and what the balance stands at. Not an invoice.');
$y += 30;

# kerncijfers naast elkaar, zoals een kop boven een tabblad
my @kern = (
  ['Orders',          scalar(@orders)],
  ['Received',        'EUR ' . euro($bruto)],
  ['Transaction fees','EUR ' . euro(-$fees)],
  ['Refunds',         'EUR ' . euro(-$refunds)],
  ['Chargebacks',     'EUR ' . euro(-$chargebacks)],
  ['Balance',         'EUR ' . euro($netto)],
);
my $kx = $M;
my $stap = ($W - 2 * $M) / scalar(@kern);
for my $k (@kern) {
  tekst($kx, $y, 'Helvetica', 8.5, 0.45, $k->[0]);
  tekst($kx, $y + 15, $k->[0] eq 'Balance' ? 'Helvetica-Bold' : 'Helvetica',
    11, 0.05, $k->[1]);
  $kx += $stap;
}
$y += 34;
lijn($y, 0.8);
$y += 26;

# ---- alle boekingen --------------------------------------------------------
tabelkop();
my $saldo = 0;
my $vorige_dag = '';
for my $o (@orders) {
  ruimte(30);
  $saldo += $o->{bedrag};
  my $dag = $o->{dag} eq $vorige_dag ? '' : $o->{dag};
  $vorige_dag = $o->{dag};
  boeking($dag, $o->{nummer}, $o->{soort} . ' order paid with ' . $o->{methode},
    $o->{bedrag}, $saldo, 0);
  $saldo -= $o->{kosten};
  boeking('', '', $o->{methode} . ' transaction fee', -$o->{kosten}, $saldo, 0);
}

ruimte(60);
$saldo -= $refunds;
boeking('', '', 'Refunds in this period (3 orders)', -$refunds, $saldo, 0);
$saldo -= $chargebacks;
boeking('', '', 'Chargebacks in this period (1 case)', -$chargebacks, $saldo, 0);

lijn($y - 11, 0.6, 0.9);
$y += 4;
band($y - 11, 17, 0.94);
tekst($M + $K_OMS, $y, 'Helvetica-Bold', 9, 0.05, 'Balance to be paid out on 21 August 2026');
rechts($K_SALDO - 4, $y, 'Helvetica-Bold', 9, 0.05, 'EUR ' . euro($saldo));

push @paginas, [@ops];

# ---- voet op elke pagina ---------------------------------------------------
my $totaal = scalar @paginas;
for my $i (0 .. $#paginas) {
  @ops = ();
  lijn($H - 40, 0.85);
  tekst($M, $H - 26, 'Helvetica', 8, 0.5,
    'Generated on 9 September 2026 - amounts in EUR - this overview updates until the payout is sent');
  rechts($W - $M, $H - 26, 'Helvetica', 8, 0.5, 'Page ' . ($i + 1) . ' of ' . $totaal);
  push @{ $paginas[$i] }, @ops;
}

# ---- objecten --------------------------------------------------------------
my @obj;
my @paginaobj;
my $nr = 5;
for my $p (@paginas) {
  my $pagina = $nr++;
  my $stroom = $nr++;
  push @paginaobj, $pagina;
  $obj[$pagina] = sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] "
    . "/Resources << /Font << /Helvetica 3 0 R /Helvetica-Bold 4 0 R >> >> "
    . "/Contents %d 0 R >>", $W, $H, $stroom);
  my $inhoud = join("\n", @$p);
  $obj[$stroom] = "<< /Length " . length($inhoud) . " >>\nstream\n$inhoud\nendstream";
}
$obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
$obj[2] = "<< /Type /Pages /Kids [" . join(" ", map { "$_ 0 R" } @paginaobj)
        . "] /Count " . scalar(@paginaobj) . " >>";
$obj[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
$obj[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

my $laatste = $nr - 1;
my $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
my @offset;
for my $i (1 .. $laatste) {
  $offset[$i] = length($pdf);
  $pdf .= "$i 0 obj\n$obj[$i]\nendobj\n";
}
my $start = length($pdf);
$pdf .= "xref\n0 " . ($laatste + 1) . "\n0000000000 65535 f \n";
$pdf .= sprintf("%010d 00000 n \n", $offset[$_]) for 1 .. $laatste;
$pdf .= "trailer\n<< /Size " . ($laatste + 1) . " /Root 1 0 R >>\nstartxref\n$start\n%%EOF\n";

my $uit = $ARGV[0] or die "geef een bestandsnaam\n";
open my $fh, '>:raw', $uit or die "kan $uit niet schrijven: $!";
print $fh $pdf;
close $fh;
printf "ok: %s (%d bytes, %d paginas, %d orders, ontvangen %s, kosten %s, saldo %s)\n",
  $uit, length($pdf), $totaal, scalar(@orders), euro($bruto), euro($fees), euro($netto);
